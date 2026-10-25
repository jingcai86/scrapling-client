# scrapling-client

A generic, modular TypeScript / Node.js web scraping client powered by [Scrapling](https://github.com/D4Vinci/Scrapling) over the Model Context Protocol (MCP) Streamable HTTP interface.

## Overview

`scrapling-client` provides a reusable TypeScript client (`core/ScraplingClient`) that connects to a remote or local Scrapling MCP server to fetch pages with TLS fingerprint impersonation, stealthy browser automation, CSS selector scoping, and clean Markdown/HTML/text extraction—without requiring heavy local browser dependencies.

Site-specific scrapers live in their own self-contained subdirectories and build on top of the shared `core/` client.

## Architecture

```text
scrapling-client/
├── core/                  # Generic Scrapling MCP client & environment loader
│   ├── client.ts          # ScraplingClient (Streamable HTTP JSON-RPC / SSE handler)
│   ├── env.ts             # Zero-dependency .env loader
│   └── index.ts           # Public core exports & TypeScript types
├── tests/                 # Unit tests for the core client
├── .env.example           # Example environment configuration (safe to commit)
├── package.json
└── tsconfig.json
```

## Setup

1. **Install dependencies** (requires Node.js 18+):

   ```bash
   npm install
   ```

2. **Configure environment variables**:

   Copy `.env.example` to `.env` in your local working directory and set your Scrapling MCP server endpoint:

   ```bash
   cp .env.example .env
   ```

   Edit `.env`:

   ```dotenv
   SCRAPLING_MCP_URL=http://localhost:8000/mcp
   SCRAPLING_TIMEOUT_MS=60000
   ```

   > **Security Note**: `.env` is ignored by Git (`.gitignore`) so private server addresses, hostnames, and credentials are never committed to the repository.

## Generic Usage

```ts
import { ScraplingClient } from "./core/index.js";

const client = new ScraplingClient(); // Reads SCRAPLING_MCP_URL from process.env / .env

// Fast HTTP fetch with browser TLS/JA3 impersonation
const response = await client.get("https://example.com", {
  extractionType: "markdown",
  cssSelector: "main",
});

console.log(response.status, response.firstText);
```

## Scripts

- **Run all unit tests**:

  ```bash
  npm test
  ```

- **Run TypeScript type checking**:

  ```bash
  npm run typecheck
  ```

- **Build JavaScript output (`dist/`)**:

  ```bash
  npm run build
  ```
