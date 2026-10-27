# Eneba Gift Card Scrapers, Deal Analytics & PostgreSQL Schema (`eneba/`)

This directory contains the `eneba.com` gift card listing scrapers, deal status analytics, and relational PostgreSQL storage (`scrapling` generic tables) built on top of `../core/ScraplingClient`.

## Files in `eneba/`

| File | Description |
| :--- | :--- |
| [`baseScraper.ts`](./baseScraper.ts) | Shared `EnebaGiftCardScraper` base class that fetches Eneba store pages via Scrapling, extracts product cards (`div.pFaGHa`), and parses selling price, crossed-out original price, face value from title, discount %, cashback %, stock status, and offer URLs. |
| [`pageStats.ts`](./pageStats.ts) | Page status & deal analytics engine (`analyzePageDeals`, `formatPageStatusReport`). Calculates total vs. in-stock cards, **average % of discount seen on the page**, average effective discount (including cashback), and ranks the **top 10 deals (`rank` 1–10)** on each page. |
| [`db.ts`](./db.ts) | PostgreSQL persistence layer (`ensureEnebaSchema`, `savePageDealsToDb`). Automatically creates the `scrapling` schema and relational tables (`scrapling.products`, `scrapling.scrape_runs`, `scrapling.top_deals`, `scrapling.sellers`, `scrapling.product_offers`) and stores the top ranked deals per page scrape with `scraped_at` and `rank` (`1..N`). |
| [`playstationGiftCard.ts`](./playstationGiftCard.ts) | Scraper for **PlayStation (PSN) Gift Cards** (`https://www.eneba.com/us/store/psn-gift-cards`). |
| [`nintendoGiftCard.ts`](./nintendoGiftCard.ts) | Scraper for **Nintendo eShop Gift Cards** (`https://www.eneba.com/us/store/nintendo-gift-cards`). |
| [`androidGiftCard.ts`](./androidGiftCard.ts) | Scraper for **Android (Google Play) Gift Cards** (`https://www.eneba.com/us/store/google-play-gift-cards`). |
| [`amazonGiftCard.ts`](./amazonGiftCard.ts) | Scraper for **Amazon Gift Cards** (`https://www.eneba.com/us/store/amazon-gift-cards`). |
| [`appleGiftCard.ts`](./appleGiftCard.ts) | Scraper for **Apple Gift Cards** (`https://www.eneba.com/us/store/apple-gift-cards`). |
| [`runAll.ts`](./runAll.ts) | Runs all five gift card scrapers, prints per-page top-10 status reports + cross-category summary, and persists the batch into PostgreSQL. |
| [`enebaStats.test.ts`](./enebaStats.test.ts) | Unit tests for Eneba card Markdown parsing and page discount statistics. |

## PostgreSQL Schema (`scrapling.*`)

When `DATABASE_URL` is configured in your local `.env`, running any scraper automatically initializes the `scrapling` schema and stores the scrape results across normalized tables with a `provider` column (e.g. `'eneba'`, `'g2a'`):

- **`scrapling.products`**: Unique gift card catalog keyed by product `url` / `slug` (`provider`, `title`, `region`, `face_value`, `face_value_currency`, `first_seen_at`, `last_seen_at`).
- **`scrapling.scrape_runs`**: Page-level scrape snapshot (`batch_id`, `scraped_at`, `provider`, `category`, `page_url`, `page_number`, `total_listings`, `in_stock_count`, `avg_discount_pct_on_discounted`, `avg_effective_discount_pct`, `max_discount_pct`, etc.).
- **`scrapling.top_deals`**: The **top deals (`rank` 1–N)** per page scrape, with foreign keys `scrape_run_id -> scrapling.scrape_runs(id)` and `product_id -> scrapling.products(id)`, plus `provider`, `scraped_at`, `rank`, `selling_price`, `original_price`, `discount_pct`, `cashback_pct`, `effective_discount_pct`, `effective_price`, and `savings_amount`.
- **`scrapling.sellers`** & **`scrapling.product_offers`**: Relational tables for merchant ratings and individual seller offers linked to `scrapling.products(id)`.

## Usage

Make sure your local `.env` in the repository root has `SCRAPLING_MCP_URL` (and optionally `DATABASE_URL`) configured.

```bash
# Scrape individual gift card pages (prints top 10 & stores in PostgreSQL)
npx tsx eneba/playstationGiftCard.ts
npx tsx eneba/nintendoGiftCard.ts
npx tsx eneba/androidGiftCard.ts
npx tsx eneba/amazonGiftCard.ts
npx tsx eneba/appleGiftCard.ts

# Scrape & compare all 5 gift card pages
npx tsx eneba/runAll.ts
```

### CLI Options

- `--page <N>`: Scrape page number `N` (default: `1`)
- `--top <N>`: Number of top ranked deals to display per page (default: `10`)
- `--stealth`: Use Scrapling's headless Chromium `stealthy_fetch` instead of fast HTTP TLS impersonation
- `--json`: Output structured JSON instead of the formatted table report
- `--no-offers`: Skip scraping competing seller offers on the #1 best deal page (enabled by default)
- `--no-db`: Skip storing results in PostgreSQL even if `DATABASE_URL` is set (note: if PostgreSQL is unreachable or fails for any reason, the scraper logs a warning to `stderr` and still returns the full JSON/CLI result)
