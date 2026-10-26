# scrapling-client

A generic, modular TypeScript / Node.js web scraping client, deal monitor dashboard, randomized cron scheduler, and Resend email alert server powered by [Scrapling](https://github.com/D4Vinci/Scrapling) over the Model Context Protocol (MCP) Streamable HTTP interface, with optional PostgreSQL persistence.

## Overview

`scrapling-client` provides:
- **Core Scrapling MCP Client (`core/ScraplingClient`)**: Connects to a remote or local Scrapling MCP server with multi-tier anti-bot escalation (rotating browser TLS impersonation → stealthy headless Chromium → Cloudflare Turnstile solver).
- **Web Dashboard & Server (`server/`)**: Interactive UI and JSON API to view deal status & top ranked deals across providers, add/delete/toggle scraping pages, trigger live scrapes, edit `.env` variables in-place, configure randomized daily cron schedules, and preview/send email alerts.
- **Randomized Daily Cron Scheduler (`core/RandomizedDailyScheduler`)**: Schedules daily scrapes starting at `CRON_BASE_TIME` (e.g. `19:00` / 7:00 PM) plus a random offset in `[0, CRON_JITTER_MINUTES]` (e.g. `0..60` minutes, running randomly between 7:00 PM and 8:00 PM).
- **Resend Email Alerts (`core/email.ts`)**: Sends formatted HTML + plain-text deal alert emails whenever any scraped deal meets or exceeds individual provider discount thresholds (e.g. `20%` off on Eneba).

## Architecture

```text
scrapling-client/
├── core/                  # Generic Scrapling MCP client, DB pool, env editor, cron & email
│   ├── client.ts          # ScraplingClient (Streamable HTTP JSON-RPC / SSE + 3-tier anti-bot)
│   ├── db.ts              # Generic PostgreSQL connection pool helper (DATABASE_URL)
│   ├── email.ts           # Resend email alert dispatcher & HTML template renderer
│   ├── env.ts             # .env parser, live in-place updater & schema metadata
│   ├── progress.ts        # Live terminal spinner & elapsed-time progress helper
│   ├── scheduler.ts       # RandomizedDailyScheduler (base time + random jitter window)
│   └── index.ts           # Public core exports & TypeScript types
├── server/                # Web dashboard UI, Express REST API, page store & scrape runner
│   ├── app.ts             # Express app setup, middleware & route mounting
│   ├── index.ts           # Server bootstrap & CLI entrypoint
│   ├── routes/            # Modular Express route handlers (dashboard, deals, pages, scrape, config)
│   ├── services/          # Domain services (pageStore, scrapeRunner, dealSearch)
│   └── ui/                # Modular dashboard UI components, styles & client scripts
├── tests/                 # Unit tests for the core client
├── Dockerfile             # Portable Node 20 Alpine container image
├── docker-compose.yml     # Docker Compose service with persistent .env and data/ mounts
├── .env.example           # Example environment configuration (safe to commit)
├── package.json
└── tsconfig.json
```

## Setup & Running Locally

1. **Install dependencies** (requires Node.js 18+):

   ```bash
   npm install
   ```

2. **Configure environment variables**:

   ```bash
   cp .env.example .env
   ```

   You can edit `.env` directly or through the Web Dashboard UI (`Environment (.env)` tab).

3. **Start the Web Dashboard & Scheduler Server**:

   ```bash
   npm start
   # Or in watch mode during development:
   npm run dev
   ```

   Open `http://localhost` (port `80`) in your browser.

## Running with Docker Compose

```bash
docker compose up -d --build
```

The `docker-compose.yml` mounts `./.env` and `./data` into the container so any `.env` changes or scraping pages added via the Web UI are persisted on the host.

## Deal Search API (for Hermes / External Agents)

Both `GET /api/deals/search` and `POST /api/deals/search` (also aliased at `/api/deals`) allow searching deals by product/category name, date/timestamp (such as `yesterday`, `today`, `24h`, `7d`, `YYYY-MM-DD`, or an ISO/Unix timestamp), and `best=true`:

```bash
# 1. Search by name (e.g., Apple Gift Card)
curl "http://localhost/api/deals/search?q=apple+gift+card"

# 2. Get the #1 best deal from yesterday (across all categories)
curl "http://localhost/api/deals/search?date=yesterday&best=true"

# 3. Combine both: Best Apple Gift Card deal from yesterday (or a specific timestamp)
curl "http://localhost/api/deals/search?q=apple+gift+card&timestamp=yesterday&best=true"

# 4. POST JSON payload (for tool/agent callers)
curl -X POST "http://localhost/api/deals/search" \
  -H "Content-Type: application/json" \
  -d '{"q": "apple gift card", "date": "yesterday", "bestOnly": true}'
```

The response includes a top-level `bestDeal` object (the highest effective discount match) as well as the `deals` array and `totalMatches`.

## Scripts

- `npm start`: Start the web dashboard and randomized cron server (`http://localhost` on port `80`)
- `npm run dev`: Start the server in watch mode
- `npm test`: Run all unit and integration tests
- `npm run typecheck`: Run TypeScript type checking
- `npm run build`: Compile TypeScript to `dist/`
