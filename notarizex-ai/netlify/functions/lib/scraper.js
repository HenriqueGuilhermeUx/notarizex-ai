const fetch = require('node-fetch');
const cheerio = require('cheerio');

/**
 * Extrai conteúdo de texto de um site
 * @param {string} url - URL do site para fazer scraping
 * @returns {Promise<string>} - Texto extraído do site
 */
async function scrapeWebsite(url) {
    try {
        console.log('[Scraper] Iniciando scraping de:', url);
        
        // Validar URL
        if (!url || !url.startsWith('http')) {
            throw new Error('URL inválida');
        }

        // Fazer requisição HTTP
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 15000 // 15 segundos
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // Remover scripts, styles e elementos desnecessários
        $('script, style, nav, header, footer, iframe, noscript').remove();

        // Extrair texto de elementos importantes
        const content = [];

        // Título da página
        const title = $('title').text().trim();
        if (title) {
            content.push(`# ${title}\n`);
        }

        // Meta description
        const description = $('meta[name="description"]').attr('content');
        if (description) {
            content.push(`${description}\n`);
        }

        // Headings (h1, h2, h3)
        $('h1, h2, h3').each((i, elem) => {
            const text = $(elem).text().trim();
            if (text && text.length > 3) {
                const level = elem.name === 'h1' ? '##' : elem.name === 'h2' ? '###' : '####';
                content.push(`${level} ${text}\n`);
            }
        });

        // Parágrafos
        $('p').each((i, elem) => {
            const text = $(elem).text().trim();
            if (text && text.length > 20) { // Ignorar parágrafos muito curtos
                content.push(`${text}\n`);
            }
        });

        // Listas
        $('ul, ol').each((i, elem) => {
            const items = [];
            $(elem).find('li').each((j, li) => {
                const text = $(li).text().trim();
                if (text && text.length > 3) {
                    items.push(`- ${text}`);
                }
            });
            if (items.length > 0) {
                content.push(items.join('\n') + '\n');
            }
        });

        // Juntar todo o conteúdo
        let extractedText = content.join('\n').trim();

        // Limpar espaços em branco excessivos
        extractedText = extractedText.replace(/\n{3,}/g, '\n\n');

        // Limitar tamanho (máximo 50.000 caracteres para evitar custos excessivos)
        if (extractedText.length > 50000) {
            extractedText = extractedText.substring(0, 50000) + '\n\n[Conteúdo truncado por exceder o limite]';
        }

        console.log('[Scraper] Scraping concluído. Caracteres extraídos:', extractedText.length);

        if (extractedText.length < 100) {
            throw new Error('Conteúdo extraído insuficiente. Verifique se o site está acessível.');
        }

        return extractedText;

    } catch (error) {
        console.error('[Scraper] Erro:', error.message);
        throw new Error(`Falha ao extrair conteúdo do site: ${error.message}`);
    }
}

/**
 * Tenta fazer scraping de múltiplas páginas do site
 * @param {string} baseUrl - URL base do site
 * @param {number} maxPages - Número máximo de páginas para fazer scraping (padrão: 1)
 * @returns {Promise<string>} - Texto combinado de todas as páginas
 */
async function scrapeMultiplePages(baseUrl, maxPages = 1) {
    try {
        console.log('[Scraper] Scraping de múltiplas páginas:', baseUrl, 'Max:', maxPages);
        
        const contents = [];
        
        // Fazer scraping da página principal
        const mainContent = await scrapeWebsite(baseUrl);
        contents.push(mainContent);

        // Se maxPages > 1, tentar encontrar e fazer scraping de outras páginas
        if (maxPages > 1) {
            // Por enquanto, apenas a página principal
            // Futuramente, pode-se adicionar lógica para seguir links
            console.log('[Scraper] Scraping de múltiplas páginas ainda não implementado completamente');
        }

        return contents.join('\n\n---\n\n');

    } catch (error) {
        console.error('[Scraper] Erro no scraping múltiplo:', error.message);
        throw error;
    }
}

module.exports = {
    scrapeWebsite,
    scrapeMultiplePages
};
