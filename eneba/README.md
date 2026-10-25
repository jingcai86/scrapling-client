# Eneba Gift Card Scrapers & Deal Analytics (`eneba/`)

This directory contains the `eneba.com` gift card listing scrapers and deal status analytics built on top of `../core/ScraplingClient`.

## Files in `eneba/`

| File | Description |
| :--- | :--- |
| [`baseScraper.ts`](./baseScraper.ts) | Shared `EnebaGiftCardScraper` base class that fetches Eneba store pages via Scrapling, extracts product cards (`div.pFaGHa`), and parses selling price, crossed-out original price, face value from title, discount %, cashback %, stock status, and offer URLs. |
| [`pageStats.ts`](./pageStats.ts) | Page status & deal analytics engine (`analyzePageDeals`, `formatPageStatusReport`). Calculates total vs. in-stock cards, **average % of discount seen on the page**, average effective discount (including cashback), and ranks listings to find the **best deal on each page**. |
| [`playstationGiftCard.ts`](./playstationGiftCard.ts) | Scraper for **PlayStation (PSN) Gift Cards** (`https://www.eneba.com/us/store/psn-gift-cards`). |
| [`nintendoGiftCard.ts`](./nintendoGiftCard.ts) | Scraper for **Nintendo eShop Gift Cards** (`https://www.eneba.com/us/store/nintendo-gift-cards`). |
| [`androidGiftCard.ts`](./androidGiftCard.ts) | Scraper for **Android (Google Play) Gift Cards** (`https://www.eneba.com/us/store/google-play-gift-cards`). |
| [`amazonGiftCard.ts`](./amazonGiftCard.ts) | Scraper for **Amazon Gift Cards** (`https://www.eneba.com/us/store/amazon-gift-cards`). |
| [`runAll.ts`](./runAll.ts) | Runs all four gift card scrapers and prints per-page status reports plus a cross-category best-deal comparison table. |
| [`enebaStats.test.ts`](./enebaStats.test.ts) | Unit tests for Eneba card Markdown parsing and page discount statistics. |

## Usage

Make sure your local `.env` in the repository root has `SCRAPLING_MCP_URL` configured.

### Scrape Individual Gift Card Pages

```bash
# PlayStation (PSN) gift cards
npx tsx eneba/playstationGiftCard.ts

# Nintendo eShop gift cards
npx tsx eneba/nintendoGiftCard.ts

# Android (Google Play) gift cards
npx tsx eneba/androidGiftCard.ts

# Amazon gift cards
npx tsx eneba/amazonGiftCard.ts
```

### Scrape & Compare All 4 Gift Card Pages

```bash
npx tsx eneba/runAll.ts
```

### CLI Options

All scraper entrypoints support the following optional flags:

- `--page <N>`: Scrape page number `N` (default: `1`)
- `--top <N>`: Number of top ranked deals to display per page (default: `5`)
- `--stealth`: Use Scrapling's headless Chromium `stealthy_fetch` instead of fast HTTP TLS impersonation
- `--json`: Output structured JSON instead of the formatted table report
