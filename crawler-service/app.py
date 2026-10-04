import asyncio
import collections
import ipaddress
import os
import re
import socket
from urllib.parse import urljoin, urlparse, urldefrag

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
from scrapling.fetchers import Fetcher

try:
    from scrapling.fetchers import DynamicFetcher
except Exception:
    DynamicFetcher = None

app = FastAPI(title="SmartBots Crawler", version="1.0.0")

MAX_PAGE_CHARS = 50000
MAX_TOTAL_CHARS = 180000
PRIORITY_RE = re.compile(r"(servi|solu|produto|catalog|pre[cç]o|plano|faq|duvida|agend|contat|sobre|empresa|curso|menu|cardap|im[oó]ve)", re.I)
SKIP_RE = re.compile(r"(login|checkout|carrinho|privacidade|termos|cookie|wp-admin|logout|javascript:|mailto:|tel:)", re.I)
HEX_RE = re.compile(r"#[0-9a-fA-F]{6}\b")


class CrawlRequest(BaseModel):
    url: str
    max_pages: int = Field(default=8, ge=1, le=12)


def _clean(value):
    return re.sub(r"\s+", " ", str(value or "")).strip()


def _normalize_url(value: str) -> str:
    raw = _clean(value)
    if not re.match(r"^https?://", raw, re.I):
        raw = "https://" + raw
    parsed = urlparse(raw)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise ValueError("URL inválida")
    return urldefrag(raw)[0]


def _assert_public_host(url: str) -> None:
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    if not host or host in {"localhost"} or host.endswith((".local", ".internal")):
        raise ValueError("Host não permitido")
    try:
        infos = socket.getaddrinfo(host, parsed.port or (443 if parsed.scheme == "https" else 80), proto=socket.IPPROTO_TCP)
    except socket.gaierror as exc:
        raise ValueError("Não foi possível resolver o domínio") from exc
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
            raise ValueError("Endereço privado não permitido")


def _safe_same_origin(base: str, href: str):
    try:
        absolute = urldefrag(urljoin(base, href))[0]
        b, u = urlparse(base), urlparse(absolute)
        if u.scheme not in ("http", "https") or u.netloc != b.netloc:
            return None
        if SKIP_RE.search(absolute):
            return None
        return absolute
    except Exception:
        return None


def _attr_first(page, selector: str):
    try:
        return _clean(page.css(selector).get(""))
    except Exception:
        return ""


def _extract(page, url: str):
    title = _attr_first(page, "title::text") or _attr_first(page, "h1::text") or (urlparse(url).hostname or "")
    description = _attr_first(page, 'meta[name="description"]::attr(content)') or _attr_first(page, 'meta[property="og:description"]::attr(content)')
    theme_color = _attr_first(page, 'meta[name="theme-color"]::attr(content)')

    try:
        text = str(page.markdown(main_content_only=True))
    except Exception:
        text = str(page.get_all_text(separator="\n", strip=True, ignore_tags=("script", "style", "noscript", "svg")))
    text = re.sub(r"\n{3,}", "\n\n", text).strip()[:MAX_PAGE_CHARS]

    links = []
    try:
        for href in page.css("a::attr(href)").getall():
            safe = _safe_same_origin(url, str(href))
            if safe and safe not in links:
                links.append(safe)
    except Exception:
        pass

    logo = ""
    for selector in (
        'img[src*="logo" i]::attr(src)',
        'img[class*="logo" i]::attr(src)',
        'link[rel*="icon"]::attr(href)',
    ):
        raw = _attr_first(page, selector)
        if raw:
            logo = urljoin(url, raw)
            break
    hero_image = _attr_first(page, 'meta[property="og:image"]::attr(content)')
    hero_image = urljoin(url, hero_image) if hero_image else ""

    colors = []
    if theme_color and re.fullmatch(r"#[0-9a-fA-F]{6}", theme_color):
        colors.append(theme_color.lower())
    try:
        html = str(page.html_content)
        counts = collections.Counter(x.lower() for x in HEX_RE.findall(html))
        for color, _ in counts.most_common(12):
            if color not in {"#ffffff", "#000000", "#f5f5f5", "#fafafa", "#111111"} and color not in colors:
                colors.append(color)
            if len(colors) >= 5:
                break
    except Exception:
        pass

    return {
        "url": url,
        "title": title[:300],
        "description": description[:700],
        "text": text,
        "links": links,
        "brand": {"logoUrl": logo, "heroImageUrl": hero_image, "colors": colors},
    }


def _fetch(url: str):
    _assert_public_host(url)
    page = Fetcher.get(url, stealthy_headers=True, follow_redirects="safe", timeout=18, retries=2)
    status = int(getattr(page, "status", 200) or 200)
    if status >= 400:
        raise ValueError(f"HTTP {status}")
    extracted = _extract(page, str(getattr(page, "url", None) or url))

    browser_enabled = os.getenv("SMARTBOTS_CRAWLER_BROWSER", "0") == "1"
    if browser_enabled and DynamicFetcher is not None and len(extracted["text"]) < 350:
        try:
            dynamic = DynamicFetcher.fetch(url, headless=True, network_idle=True, timeout=22000)
            extracted = _extract(dynamic, str(getattr(dynamic, "url", None) or url))
        except Exception:
            pass
    return extracted


def _priority(url: str):
    score = 0
    if PRIORITY_RE.search(url):
        score += 10
    if re.search(r"(blog|noticia|news|post/)", url, re.I):
        score -= 5
    return score


def _crawl(start_url: str, max_pages: int):
    start = _normalize_url(start_url)
    _assert_public_host(start)
    origin = f"{urlparse(start).scheme}://{urlparse(start).netloc}"
    queue = [(100, start)]
    visited = set()
    pages = []
    total = 0
    brand = {"logoUrl": "", "heroImageUrl": "", "colors": []}

    while queue and len(pages) < max_pages and total < MAX_TOTAL_CHARS:
        queue.sort(key=lambda x: x[0], reverse=True)
        _, url = queue.pop(0)
        if url in visited:
            continue
        visited.add(url)
        try:
            page = _fetch(url)
        except Exception:
            continue
        if len(page["text"]) < 80:
            continue

        remaining = MAX_TOTAL_CHARS - total
        page["text"] = page["text"][:remaining]
        total += len(page["text"])
        if not brand["logoUrl"] and page["brand"].get("logoUrl"):
            brand["logoUrl"] = page["brand"]["logoUrl"]
        if not brand["heroImageUrl"] and page["brand"].get("heroImageUrl"):
            brand["heroImageUrl"] = page["brand"]["heroImageUrl"]
        for c in page["brand"].get("colors", []):
            if c not in brand["colors"]:
                brand["colors"].append(c)
            if len(brand["colors"]) >= 5:
                break

        links = page.pop("links", [])
        page.pop("brand", None)
        pages.append(page)

        for link in links:
            if not link.startswith(origin) or link in visited:
                continue
            if all(existing[1] != link for existing in queue):
                queue.append((_priority(link), link))

    if not pages:
        raise ValueError("Não foi possível extrair conteúdo útil do site")

    combined = "\n\n--- PÁGINA ---\n\n".join(
        f"URL: {p['url']}\n{p['text']}" for p in pages
    )[:MAX_TOTAL_CHARS]

    return {
        "success": True,
        "baseUrl": start,
        "pages": pages,
        "combinedText": combined,
        "pageCount": len(pages),
        "totalChars": len(combined),
        "brand": brand,
    }


def _auth(x_crawler_key: str | None):
    expected = os.getenv("SMARTBOTS_CRAWLER_SECRET", "").strip()
    if not expected:
        raise HTTPException(status_code=503, detail="crawler_not_configured")
    if (x_crawler_key or "").strip() != expected:
        raise HTTPException(status_code=401, detail="unauthorized")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "smartbots-crawler"}


@app.post("/crawl")
async def crawl(payload: CrawlRequest, x_crawler_key: str | None = Header(default=None)):
    _auth(x_crawler_key)
    try:
        return await asyncio.wait_for(
            asyncio.to_thread(_crawl, payload.url, payload.max_pages),
            timeout=35,
        )
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="crawl_timeout")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception:
        raise HTTPException(status_code=500, detail="crawl_failed")
