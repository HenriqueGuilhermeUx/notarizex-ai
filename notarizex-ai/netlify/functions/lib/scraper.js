const fetch = require('node-fetch');
const cheerio = require('cheerio');
const dns = require('dns').promises;
const net = require('net');

const USER_AGENT = 'SmartBotsBusinessCrawler/2.0 (+https://smartbots.club)';
const DEFAULT_TIMEOUT = 12000;
const MAX_PAGE_CHARS = 50000;
const MAX_COMBINED_CHARS = 160000;

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeWebsiteUrl(value) {
  let raw = clean(value);
  if (!raw) throw new Error('URL inválida');
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Apenas URLs HTTP/HTTPS são permitidas');
  url.hash = '';
  return url;
}

function isPrivateIpv4(ip) {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return false;
  return p[0] === 10 ||
    p[0] === 127 ||
    (p[0] === 169 && p[1] === 254) ||
    (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
    (p[0] === 192 && p[1] === 168) ||
    (p[0] === 100 && p[1] >= 64 && p[1] <= 127) ||
    p[0] === 0;
}

function isPrivateIp(ip) {
  const family = net.isIP(ip);
  if (family === 4) return isPrivateIpv4(ip);
  if (family === 6) {
    const x = ip.toLowerCase();
    return x === '::1' || x === '::' || x.startsWith('fc') || x.startsWith('fd') || x.startsWith('fe80:') || x.startsWith('::ffff:127.') || x.startsWith('::ffff:10.') || x.startsWith('::ffff:192.168.');
  }
  return false;
}

async function assertPublicUrl(url) {
  const hostname = String(url.hostname || '').toLowerCase();
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new Error('Host não permitido');
  }
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new Error('Endereço privado não permitido');
    return;
  }
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    if (!addresses.length || addresses.some((a) => isPrivateIp(a.address))) throw new Error('Host privado não permitido');
  } catch (error) {
    if (/privado|permitido/i.test(error.message)) throw error;
    throw new Error(`Não foi possível resolver o domínio ${hostname}`);
  }
}

async function safeFetch(url, redirectCount = 0) {
  if (redirectCount > 4) throw new Error('Muitos redirecionamentos');
  await assertPublicUrl(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
  try {
    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml'
      },
      redirect: 'manual',
      signal: controller.signal
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error(`Redirecionamento HTTP ${response.status} sem destino`);
      const next = new URL(location, url);
      if (!['http:', 'https:'].includes(next.protocol)) throw new Error('Redirecionamento inválido');
      return safeFetch(next, redirectCount + 1);
    }
    return response;
  } finally {
    clearTimeout(timer);
  }
}

function extractPage(html, pageUrl) {
  const $ = cheerio.load(html);
  $('script, style, iframe, noscript, svg, canvas, template').remove();
  $('[aria-hidden="true"]').remove();

  const title = clean($('title').first().text()) || clean($('h1').first().text()) || pageUrl.hostname;
  const description = clean($('meta[name="description"]').attr('content'));
  const content = [];

  if (title) content.push(`# ${title}`);
  if (description) content.push(description);

  $('main h1, main h2, main h3, article h1, article h2, article h3, body h1, body h2, body h3').each((_, elem) => {
    const value = clean($(elem).text());
    if (value && value.length > 2) content.push(value);
  });

  $('main p, article p, section p, body p').each((_, elem) => {
    const value = clean($(elem).text());
    if (value && value.length > 20) content.push(value);
  });

  $('main li, article li, section li, body li').each((_, elem) => {
    const value = clean($(elem).text());
    if (value && value.length > 3 && value.length < 800) content.push(`- ${value}`);
  });

  const seen = new Set();
  let extractedText = content.filter((item) => {
    const key = item.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).join('\n').replace(/\n{3,}/g, '\n\n').trim();

  if (extractedText.length > MAX_PAGE_CHARS) extractedText = `${extractedText.slice(0, MAX_PAGE_CHARS)}\n[conteúdo truncado]`;

  const links = [];
  $('a[href]').each((_, a) => {
    const href = clean($(a).attr('href'));
    if (!href || href.startsWith('#') || /^(mailto:|tel:|javascript:)/i.test(href)) return;
    try {
      const u = new URL(href, pageUrl);
      u.hash = '';
      if (!['http:', 'https:'].includes(u.protocol)) return;
      links.push({ url: u.toString(), label: clean($(a).text()) });
    } catch (_) {}
  });

  return { title, description, text: extractedText, links };
}

function pagePriority(urlString, label = '') {
  let path = '';
  try { path = decodeURIComponent(new URL(urlString).pathname.toLowerCase()); } catch (_) {}
  const haystack = `${path} ${String(label || '').toLowerCase()}`;
  let score = 0;
  if (/servi|solu|produto|catalog|loja|shop|tratamento|especialidade|procedimento/.test(haystack)) score += 12;
  if (/pre[cç]o|valor|plano|pricing/.test(haystack)) score += 11;
  if (/faq|duvida|pergunt|ajuda/.test(haystack)) score += 10;
  if (/agend|reserv|horario|horário|contat|fale|atendimento/.test(haystack)) score += 9;
  if (/sobre|quem-somos|empresa|clinica|clínica|equipe|profissional/.test(haystack)) score += 8;
  if (/cardap|menu|curso|turma|imove|imóve|portfolio|portfólio/.test(haystack)) score += 8;
  if (/politica|privacidade|termos|cookie|login|carrinho|checkout/.test(haystack)) score -= 20;
  if (/blog|noticia|news|artigo|post\//.test(haystack)) score -= 6;
  return score;
}

function canonicalize(urlString) {
  try {
    const u = new URL(urlString);
    u.hash = '';
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid'].forEach((k) => u.searchParams.delete(k));
    if (u.pathname !== '/') u.pathname = u.pathname.replace(/\/+$/, '');
    return u.toString();
  } catch (_) {
    return urlString;
  }
}

async function scrapePage(urlInput) {
  const url = normalizeWebsiteUrl(urlInput);
  const response = await safeFetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  const type = String(response.headers.get('content-type') || '').toLowerCase();
  if (type && !type.includes('text/html') && !type.includes('application/xhtml+xml')) throw new Error('A URL não retornou uma página HTML');
  const html = await response.text();
  const page = extractPage(html, new URL(response.url || url.toString()));
  if (page.text.length < 80) throw new Error('Conteúdo extraído insuficiente');
  return { url: response.url || url.toString(), ...page };
}

async function scrapeWebsiteDeep(baseUrl, maxPages = 8) {
  const start = normalizeWebsiteUrl(baseUrl);
  const origin = start.origin;
  const max = Math.max(1, Math.min(12, Number(maxPages) || 8));
  const visited = new Set();
  const queued = new Set();
  const queue = [{ url: canonicalize(start.toString()), label: 'home', score: 100 }];
  const pages = [];
  let combinedChars = 0;

  while (queue.length && pages.length < max && combinedChars < MAX_COMBINED_CHARS) {
    queue.sort((a, b) => b.score - a.score);
    const next = queue.shift();
    const key = canonicalize(next.url);
    if (visited.has(key)) continue;
    visited.add(key);

    let parsed;
    try { parsed = new URL(key); } catch (_) { continue; }
    if (parsed.origin !== origin) continue;

    try {
      const page = await scrapePage(key);
      const remaining = MAX_COMBINED_CHARS - combinedChars;
      const pageText = page.text.slice(0, Math.max(0, remaining));
      if (pageText.length < 80) continue;
      pages.push({ url: page.url, title: page.title, description: page.description, text: pageText });
      combinedChars += pageText.length;

      for (const link of page.links) {
        let u;
        try { u = new URL(link.url); } catch (_) { continue; }
        if (u.origin !== origin) continue;
        const canonical = canonicalize(u.toString());
        if (visited.has(canonical) || queued.has(canonical)) continue;
        const score = pagePriority(canonical, link.label);
        if (score < -5) continue;
        queued.add(canonical);
        queue.push({ url: canonical, label: link.label, score });
      }
    } catch (error) {
      console.warn('[Scraper] página ignorada:', key, error.message);
    }
  }

  if (!pages.length) throw new Error('Não foi possível extrair conteúdo útil do site');

  const combinedText = pages.map((p) => `URL: ${p.url}\n${p.text}`).join('\n\n--- PÁGINA ---\n\n').slice(0, MAX_COMBINED_CHARS);
  return {
    baseUrl: start.toString(),
    pages,
    combinedText,
    pageCount: pages.length,
    totalChars: combinedText.length
  };
}

async function scrapeWebsite(url) {
  const page = await scrapePage(url);
  return page.text;
}

async function scrapeMultiplePages(baseUrl, maxPages = 8) {
  const result = await scrapeWebsiteDeep(baseUrl, maxPages);
  return result.combinedText;
}

module.exports = {
  scrapeWebsite,
  scrapeMultiplePages,
  scrapeWebsiteDeep,
  normalizeWebsiteUrl
};
