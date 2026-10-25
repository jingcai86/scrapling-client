# scrapling-client

A generic, modular TypeScript / Node.js web scraping client, deal monitor dashboard, randomized cron scheduler, and Resend email alert server powered by [Scrapling](https://github.com/D4Vinci/Scrapling) over the Model Context Protocol (MCP) Streamable HTTP interface, with optional PostgreSQL persistence.

## Overview

`scrapling-client` provides:
- **Core Scrapling MCP Client (`core/ScraplingClient`)**: Connects to a remote or local Scrapling MCP server with multi-tier anti-bot escalation (rotating browser TLS impersonation → stealthy headless Chromium → Cloudflare Turnstile solver).
- **Web Dashboard & Server (`server/`)**: Interactive UI and JSON API to view deal status & top ranked deals across providers, add/delete/toggle scraping pages, trigger live scrapes, edit `.env` variables in-place, configure randomized daily cron schedules, and preview/send email alerts.
- **Randomized Daily Cron Scheduler (`core/RandomizedDailyScheduler`)**: Schedules daily scrapes starting at `CRON_BASE_TIME` (e.g. `19:00` / 7:00 PM) plus a random offset in `[0, CRON_JITTER_MINUTES]` (e.g. `0..60` minutes, running randomly between 7:00 PM and 8:00 PM).
- **Resend Email Alerts (`core/email.ts`)**: Sends formatted HTML + plain-text deal alert emails whenever any scraped deal meets or exceeds `ALERT_DISCOUNT_THRESHOLD_PCT` (e.g. `20%` off).

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
├── server/                # Web dashboard UI, REST API, page store & scrape runner
│   ├── index.ts           # HTTP server & API endpoints
│   ├── pageStore.ts       # Persistent store for configured scraping pages
│   ├── scrapeRunner.ts    # Live scrape coordinator, DB persistence & email alert trigger
│   └── ui.ts              # Responsive single-page dashboard UI
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

   Open `http://localhost:3000` in your browser.

## Running with Docker Compose

```bash
docker compose up -d --build
```

The `docker-compose.yml` mounts `./.env` and `./data` into the container so any `.env` changes or scraping pages added via the Web UI are persisted on the host.

## Scripts

- `npm start`: Start the web dashboard and randomized cron server (`http://localhost:3000`)
- `npm run dev`: Start the server in watch mode
- `npm test`: Run all unit and integration tests
- `npm run typecheck`: Run TypeScript type checking
- `npm run build`: Compile TypeScript to `dist/`
