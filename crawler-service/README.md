# SmartBots Crawler

Internal crawling service for SmartBots onboarding and MiniSite generation.

- Uses Scrapling first.
- Blocks private/internal hosts to reduce SSRF risk.
- Keeps the existing Node crawler as a fallback in SmartBots.
- Browser rendering can be enabled later with `SMARTBOTS_CRAWLER_BROWSER=1`.

Endpoints:
- `GET /health`
- `POST /crawl` with `X-Crawler-Key`

This service is not a generic public scraping API.
