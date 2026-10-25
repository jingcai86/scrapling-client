# Eneba Gift Card Scrapers, Deal Analytics & PostgreSQL Schema (`eneba/`)

This directory contains the `eneba.com` gift card listing scrapers, deal status analytics, and relational PostgreSQL storage (`eneba.*` schema) built on top of `../core/ScraplingClient`.

## Files in `eneba/`

| File | Description |
| :--- | :--- |
| [`baseScraper.ts`](./baseScraper.ts) | Shared `EnebaGiftCardScraper` base class that fetches Eneba store pages via Scrapling, extracts product cards (`div.pFaGHa`), and parses selling price, crossed-out original price, face value from title, discount %, cashback %, stock status, and offer URLs. |
| [`pageStats.ts`](./pageStats.ts) | Page status & deal analytics engine (`analyzePageDeals`, `formatPageStatusReport`). Calculates total vs. in-stock cards, **average % of discount seen on the page**, average effective discount (including cashback), and ranks the **top 10 deals (`rank` 1–10)** on each page. |
| [`db.ts`](./db.ts) | PostgreSQL persistence layer (`ensureEnebaSchema`, `savePageDealsToDb`). Automatically creates the `eneba` schema and relational tables (`eneba.products`, `eneba.scrape_runs`, `eneba.top_deals`, `eneba.sellers`, `eneba.product_offers`) and stores the top 10 ranked deals per page scrape with `scraped_at` and `rank` (`1..10`). |
| [`playstationGiftCard.ts`](./playstationGiftCard.ts) | Scraper for **PlayStation (PSN) Gift Cards** (`https://www.eneba.com/us/store/psn-gift-cards`). |
| [`nintendoGiftCard.ts`](./nintendoGiftCard.ts) | Scraper for **Nintendo eShop Gift Cards** (`https://www.eneba.com/us/store/nintendo-gift-cards`). |
| [`androidGiftCard.ts`](./androidGiftCard.ts) | Scraper for **Android (Google Play) Gift Cards** (`https://www.eneba.com/us/store/google-play-gift-cards`). |
| [`amazonGiftCard.ts`](./amazonGiftCard.ts) | Scraper for **Amazon Gift Cards** (`https://www.eneba.com/us/store/amazon-gift-cards`). |
| [`runAll.ts`](./runAll.ts) | Runs all four gift card scrapers, prints per-page top-10 status reports + cross-category summary, and persists the batch into PostgreSQL. |
| [`enebaStats.test.ts`](./enebaStats.test.ts) | Unit tests for Eneba card Markdown parsing and page discount statistics. |

## PostgreSQL Schema (`eneba.*`)

When `DATABASE_URL` is configured in your local `.env`, running any scraper automatically initializes the `eneba` schema and stores the scrape results across normalized tables:

- **`eneba.products`**: Unique gift card catalog keyed by product `url` / `slug` (`title`, `region`, `face_value`, `face_value_currency`, `first_seen_at`, `last_seen_at`).
- **`eneba.scrape_runs`**: Page-level scrape snapshot (`batch_id`, `scraped_at`, `category`, `page_url`, `page_number`, `total_listings`, `in_stock_count`, `avg_discount_pct_on_discounted`, `avg_effective_discount_pct`, `max_discount_pct`, etc.).
- **`eneba.top_deals`**: The **top 10 deals (`rank` 1–10)** per page scrape, with foreign keys `scrape_run_id -> eneba.scrape_runs(id)` and `product_id -> eneba.products(id)`, plus `scraped_at`, `rank`, `selling_price`, `original_price`, `discount_pct`, `cashback_pct`, `effective_discount_pct`, `effective_price`, and `savings_amount`.
- **`eneba.sellers`** & **`eneba.product_offers`**: Relational tables for merchant ratings and individual seller offers linked to `eneba.products(id)`.

## Usage

Make sure your local `.env` in the repository root has `SCRAPLING_MCP_URL` (and optionally `DATABASE_URL`) configured.

```bash
# Scrape individual gift card pages (prints top 10 & stores in PostgreSQL)
npx tsx eneba/playstationGiftCard.ts
npx tsx eneba/nintendoGiftCard.ts
npx tsx eneba/androidGiftCard.ts
npx tsx eneba/amazonGiftCard.ts

# Scrape & compare all 4 gift card pages
npx tsx eneba/runAll.ts
```

### CLI Options

- `--page <N>`: Scrape page number `N` (default: `1`)
- `--top <N>`: Number of top ranked deals to display per page (default: `10`)
- `--stealth`: Use Scrapling's headless Chromium `stealthy_fetch` instead of fast HTTP TLS impersonation
- `--json`: Output structured JSON instead of the formatted table report
- `--no-db`: Skip storing results in PostgreSQL even if `DATABASE_URL` is set
- `--with-offers`: Follow the best deal's product URL with headless Chromium to scrape competing vendor offers and populate `eneba.sellers` & `eneba.product_offers`
