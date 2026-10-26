import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type pg from "pg";
import {
  computeNextRandomizedRun,
  filterAlertableDeals,
  renderDealAlertEmailTemplate,
  type DealAlertItem,
} from "../core/index.js";
import { createDashboardServer } from "./index.js";
import { renderDashboardHtml } from "./ui.js";

function createInMemoryConfigPool(): {
  pool: pg.Pool;
  configRows: Map<string, { key: string; value: string }>;
  enebaConfigRows: Map<string, { key: string; value: string }>;
} {
  const configRows = new Map<string, { key: string; value: string }>();
  const enebaConfigRows = new Map<string, { key: string; value: string }>();

  const pool = {
    query: async (sql: string, params: unknown[] = []) => {
      const normalized = sql.replace(/\s+/g, " ").trim();

      if (
        normalized.startsWith("INSERT INTO scrapling.config") &&
        normalized.includes("ON CONFLICT (key) DO NOTHING")
      ) {
        const key = String(params[0] ?? "");
        const value = String(params[1] ?? "");
        if (key && !configRows.has(key)) {
          configRows.set(key, { key, value });
        }
        return { rows: [], rowCount: 1 };
      }

      if (
        normalized.startsWith("INSERT INTO scrapling.config") &&
        normalized.includes("ON CONFLICT (key) DO UPDATE")
      ) {
        const key = String(params[0] ?? "");
        const value = String(params[1] ?? "");
        if (key) {
          configRows.set(key, { key, value });
        }
        return { rows: [], rowCount: 1 };
      }

      if (
        normalized.startsWith(
          "SELECT key, value FROM scrapling.config ORDER BY key ASC",
        )
      ) {
        const rows = Array.from(configRows.values()).sort((a, b) =>
          a.key.localeCompare(b.key),
        );
        return { rows, rowCount: rows.length };
      }

      if (
        normalized.startsWith(
          "UPDATE scrapling.config SET value = '', updated_at = NOW() WHERE key = $1",
        )
      ) {
        const key = String(params[0] ?? "");
        if (configRows.has(key)) {
          configRows.set(key, { key, value: "" });
        }
        return { rows: [], rowCount: 1 };
      }

      if (normalized.startsWith("DELETE FROM scrapling.config WHERE key = $1")) {
        const key = String(params[0] ?? "");
        configRows.delete(key);
        return { rows: [], rowCount: 1 };
      }

      // Eneba configuration table queries
      if (
        normalized.startsWith("INSERT INTO scrapling.eneba_config") &&
        normalized.includes("ON CONFLICT (key) DO NOTHING")
      ) {
        const key = String(params[0] ?? "top_deals_limit");
        const value = String(params[1] ?? "10");
        if (!enebaConfigRows.has(key)) {
          enebaConfigRows.set(key, { key, value });
        }
        return { rows: [], rowCount: 1 };
      }

      if (
        normalized.startsWith("INSERT INTO scrapling.eneba_config") &&
        normalized.includes("ON CONFLICT (key) DO UPDATE")
      ) {
        const key = String(params[0] ?? "");
        const value = String(params[1] ?? "");
        if (key) {
          enebaConfigRows.set(key, { key, value });
        }
        return { rows: [], rowCount: 1 };
      }

      if (
        normalized.startsWith(
          "SELECT key, value FROM scrapling.eneba_config ORDER BY key ASC",
        )
      ) {
        if (!enebaConfigRows.has("top_deals_limit")) {
          enebaConfigRows.set("top_deals_limit", {
            key: "top_deals_limit",
            value: "10",
          });
        }
        if (!enebaConfigRows.has("alert_discount_threshold_pct")) {
          enebaConfigRows.set("alert_discount_threshold_pct", {
            key: "alert_discount_threshold_pct",
            value: "20",
          });
        }
        const rows = Array.from(enebaConfigRows.values()).sort((a, b) =>
          a.key.localeCompare(b.key),
        );
        return { rows, rowCount: rows.length };
      }

      return { rows: [], rowCount: 0 };
    },
    end: async () => undefined,
  } as unknown as pg.Pool;

  return { pool, configRows, enebaConfigRows };
}

describe("Server, Randomized Cron, Email Template & Page Store API", () => {
  it("computes randomized daily cron times within [baseTime, baseTime + jitterMinutes]", () => {
    const now = new Date("2026-10-25T10:00:00");
    // Roll with random = 0 (minimum offset -> 19:00:00)
    const minRoll = computeNextRandomizedRun("19:00", 60, now, false, () => 0);
    assert.equal(minRoll.chosenOffsetMinutes, 0);
    assert.equal(minRoll.chosenOffsetSeconds, 0);
    assert.equal(minRoll.nextRun.getHours(), 19);
    assert.equal(minRoll.nextRun.getMinutes(), 0);

    // Roll with random = 0.5 (halfway -> 19:30:00)
    const midRoll = computeNextRandomizedRun(
      "19:00",
      60,
      now,
      false,
      () => 0.5,
    );
    assert.equal(midRoll.chosenOffsetMinutes, 30);
    assert.equal(midRoll.nextRun.getHours(), 19);
    assert.equal(midRoll.nextRun.getMinutes(), 30);

    // Roll with random = 0.9999 (end of window -> 20:00:00)
    const maxRoll = computeNextRandomizedRun(
      "19:00",
      60,
      now,
      false,
      () => 0.999999,
    );
    assert.equal(maxRoll.chosenOffsetMinutes, 60);
    assert.equal(maxRoll.nextRun.getHours(), 20);
    assert.equal(maxRoll.nextRun.getMinutes(), 0);
  });

  it("filters deals over the 20% discount threshold and renders the Resend HTML email template", () => {
    const sampleDeals: DealAlertItem[] = [
      {
        provider: "eneba",
        category: "Nintendo eShop Gift Cards",
        title: "Nintendo eShop Card 50 USD",
        url: "https://www.eneba.com/us/nintendo-50",
        region: "United States",
        sellingPrice: 38,
        originalPrice: 50,
        faceValue: 50,
        discountPct: 24,
        cashbackPct: 0,
        effectiveDiscountPct: 24,
        effectivePrice: 38,
        savingsAmount: 12,
      },
      {
        provider: "eneba",
        category: "Amazon Gift Cards",
        title: "Amazon Gift Card 50 USD",
        url: "https://www.eneba.com/us/amazon-50",
        region: "United States",
        sellingPrice: 48,
        originalPrice: 50,
        faceValue: 50,
        discountPct: 4,
        cashbackPct: 0,
        effectiveDiscountPct: 4,
        effectivePrice: 48,
        savingsAmount: 2,
      },
    ];

    const alertable = filterAlertableDeals(sampleDeals, 20);
    assert.equal(alertable.length, 1);
    assert.equal(alertable[0].title, "Nintendo eShop Card 50 USD");

    const template = renderDealAlertEmailTemplate(alertable, {
      thresholdPct: 20,
    });
    assert.match(template.subject, /Over 20% Off/);
    assert.match(template.html, /Nintendo eShop Card 50 USD/);
    assert.match(template.html, /-24\.00%/);
  });

  it("fails to start createDashboardServer if DATABASE_URL is missing or PostgreSQL is unreachable", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "scrapling-nodb-"));
    const tmpEnvPath = path.join(tmpDir, ".env");
    fs.writeFileSync(tmpEnvPath, "PORT=80\nDATABASE_URL=\n", "utf8");

    const originalDbUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    try {
      await assert.rejects(
        () =>
          createDashboardServer({
            port: 0,
            dataDir: path.join(tmpDir, "data"),
            envPath: tmpEnvPath,
          }),
        /Missing PostgreSQL connection string/,
      );
    } finally {
      if (originalDbUrl !== undefined) {
        process.env.DATABASE_URL = originalDbUrl;
      }
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("serves dashboard API, initializes scrapling.config (empty string for missing keys), protects .env keys, and manages pages", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "scrapling-srv-"));
    const tmpEnvPath = path.join(tmpDir, ".env");
    fs.writeFileSync(
      tmpEnvPath,
      "PORT=80\nDATABASE_URL=postgresql://mock:mock@127.0.0.1:1/postgres\nSCRAPLING_MCP_URL=http://localhost:8000/mcp\nCRON_BASE_TIME=19:00\nCRON_JITTER_MINUTES=60\n",
      "utf8",
    );

    const originalDbUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    const { pool, configRows, enebaConfigRows } = createInMemoryConfigPool();

    const app = await createDashboardServer({
      port: 0,
      dataDir: path.join(tmpDir, "data"),
      envPath: tmpEnvPath,
      pool,
    });

    try {
      const baseUrl = `http://127.0.0.1:${app.port}`;

      // Verify missing keys in .env were created in scrapling.config with empty string ""
      assert.equal(configRows.get("RESEND_API_KEY")?.value, "");
      assert.equal(configRows.get("ALERT_EMAIL_TO")?.value, "");
      // And keys present in .env were seeded into scrapling.config
      assert.equal(
        configRows.get("SCRAPLING_MCP_URL")?.value,
        "http://localhost:8000/mcp",
      );
      // And PORT / DATABASE_URL are NOT stored in scrapling.config
      assert.equal(configRows.has("PORT"), false);
      assert.equal(configRows.has("DATABASE_URL"), false);

      // 1. GET /api/dashboard
      const dashRes = await fetch(`${baseUrl}/api/dashboard`);
      assert.equal(dashRes.status, 200);
      const dash = (await dashRes.json()) as {
        pages: Array<{ id: string; categoryName: string }>;
        scheduler: { baseTime: string; jitterMinutes: number };
        enebaConfig?: { top_deals_limit: string };
        env: { values: Record<string, string> };
      };
      assert.equal(dash.pages.length, 5); // PlayStation, Nintendo, Android, Amazon, Apple
      assert.equal(dash.scheduler.baseTime, "19:00");
      assert.equal(dash.scheduler.jitterMinutes, 60);
      assert.equal(dash.env.values.RESEND_API_KEY, "");
      assert.equal(dash.enebaConfig?.top_deals_limit, "10");

      // 2. POST /api/pages (Add new page)
      const addRes = await fetch(`${baseUrl}/api/pages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "eneba",
          categoryName: "Xbox Gift Cards",
          url: "https://www.eneba.com/us/store/xbox-gift-cards",
          withOffers: true,
        }),
      });
      assert.equal(addRes.status, 201);
      const added = (await addRes.json()) as { page: { id: string } };
      assert.ok(added.page.id);

      // 3. DELETE /api/pages/:id
      const delRes = await fetch(
        `${baseUrl}/api/pages/${encodeURIComponent(added.page.id)}`,
        { method: "DELETE" },
      );
      assert.equal(delRes.status, 200);

      // 4. PUT /api/env (Update scrapling.config values; verify PORT & DATABASE_URL cannot be changed)
      const envRes = await fetch(`${baseUrl}/api/env`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: {
            PORT: "9999",
            DATABASE_URL: "postgresql://hacked",
            ALERT_DISCOUNT_THRESHOLD_PCT: "25",
            CRON_BASE_TIME: "20:00",
            CRON_JITTER_MINUTES: "45",
          },
        }),
      });
      assert.equal(envRes.status, 200);
      const envUpdated = (await envRes.json()) as {
        values: Record<string, string>;
        scheduler: { baseTime: string; jitterMinutes: number };
      };
      assert.equal(envUpdated.values.ALERT_DISCOUNT_THRESHOLD_PCT, "25");
      assert.equal(envUpdated.scheduler.baseTime, "20:00");
      assert.equal(envUpdated.scheduler.jitterMinutes, 45);
      // PORT and DATABASE_URL must remain unchanged from .env
      assert.equal(envUpdated.values.PORT, "80");
      assert.equal(
        envUpdated.values.DATABASE_URL,
        "postgresql://mock:mock@127.0.0.1:1/postgres",
      );
      // Confirm updates went to scrapling.config
      assert.equal(configRows.get("ALERT_DISCOUNT_THRESHOLD_PCT")?.value, "25");
      assert.equal(configRows.get("CRON_BASE_TIME")?.value, "20:00");
      assert.equal(configRows.get("CRON_JITTER_MINUTES")?.value, "45");

      // 5. GET /api/email/preview
      const prevRes = await fetch(`${baseUrl}/api/email/preview`);
      assert.equal(prevRes.status, 200);
      const prev = (await prevRes.json()) as { html: string; subject: string };
      assert.match(prev.html, /Scrapling Monitor Alert/);

      // 5.5 GET /api/eneba/config & PUT /api/eneba/config (scrapling.eneba_config)
      const enebaCfgRes = await fetch(`${baseUrl}/api/eneba/config`);
      assert.equal(enebaCfgRes.status, 200);
      const enebaCfg = (await enebaCfgRes.json()) as {
        config: Record<string, string>;
      };
      assert.equal(enebaCfg.config.top_deals_limit, "10");
      assert.equal(enebaCfg.config.alert_discount_threshold_pct, "20");

      const updateEnebaRes = await fetch(`${baseUrl}/api/eneba/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: {
            top_deals_limit: "25",
            alert_discount_threshold_pct: "18",
          },
        }),
      });
      assert.equal(updateEnebaRes.status, 200);
      const enebaUpdated = (await updateEnebaRes.json()) as {
        config: Record<string, string>;
      };
      assert.equal(enebaUpdated.config.top_deals_limit, "25");
      assert.equal(enebaUpdated.config.alert_discount_threshold_pct, "18");
      assert.equal(enebaConfigRows.get("top_deals_limit")?.value, "25");
      assert.equal(
        enebaConfigRows.get("alert_discount_threshold_pct")?.value,
        "18",
      );

      // 6. Seed cached statuses (including a yesterday snapshot and today snapshot) and test /api/deals/search for Hermes
      const yesterdayDate = new Date();
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      yesterdayDate.setHours(19, 30, 0, 0);
      const yesterdayIso = yesterdayDate.toISOString();

      app.pageStore.saveLatestStatuses([
        {
          category: "Apple Gift Cards",
          pageUrl: "https://www.eneba.com/us/store/apple-gift-cards",
          pageNumber: 1,
          scrapedAt: yesterdayIso,
          totalListings: 2,
          inStockCount: 2,
          outOfStockCount: 0,
          discountedCount: 2,
          averageDiscountPctOnDiscounted: 8,
          averageDiscountPctAllInStock: 8,
          averageEffectiveDiscountPct: 10,
          maxDiscountPct: 10,
          maxEffectiveDiscountPct: 12,
          bestDeal: null,
          bestEffectiveDeal: null,
          bestDealOffers: [],
          topDeals: [],
          rankedDeals: [
            {
              category: "Apple Gift Cards",
              title: "Apple Gift Card 100 USD Key UNITED STATES",
              url: "https://www.eneba.com/us/apple-100",
              region: "United States",
              sellingPrice: 90,
              originalPrice: 100,
              faceValue: 100,
              faceValueCurrency: "USD",
              listedDiscountPct: 10,
              cashbackPct: 2,
              inStock: true,
              discountPct: 10,
              effectiveDiscountPct: 11.8,
              effectivePrice: 88.2,
              savingsAmount: 10,
            },
            {
              category: "Apple Gift Cards",
              title: "Apple Gift Card 50 USD Key UNITED STATES",
              url: "https://www.eneba.com/us/apple-50",
              region: "United States",
              sellingPrice: 47,
              originalPrice: 50,
              faceValue: 50,
              faceValueCurrency: "USD",
              listedDiscountPct: 6,
              cashbackPct: 0,
              inStock: true,
              discountPct: 6,
              effectiveDiscountPct: 6,
              effectivePrice: 47,
              savingsAmount: 3,
            },
          ],
        },
      ]);

      // Re-instantiate runner cache or test via newly loaded statuses
      const app2 = await createDashboardServer({
        port: 0,
        dataDir: path.join(tmpDir, "data"),
        envPath: tmpEnvPath,
        pool,
      });

      try {
        const base2 = `http://127.0.0.1:${app2.port}`;

        // Search by name + yesterday + best=true
        const searchRes = await fetch(
          `${base2}/api/deals/search?q=${encodeURIComponent("apple gift card")}&date=yesterday&best=true`,
        );
        assert.equal(searchRes.status, 200);
        const searchData = (await searchRes.json()) as {
          totalMatches: number;
          bestDeal: { title: string; effectiveDiscountPct: number } | null;
          deals: Array<{ title: string }>;
        };
        assert.equal(searchData.totalMatches, 2);
        assert.equal(searchData.deals.length, 1);
        assert.ok(searchData.bestDeal);
        assert.equal(
          searchData.bestDeal.title,
          "Apple Gift Card 100 USD Key UNITED STATES",
        );
        assert.equal(searchData.bestDeal.effectiveDiscountPct, 11.8);
      } finally {
        await app2.close();
      }
    } finally {
      await app.close();
      if (originalDbUrl !== undefined) {
        process.env.DATABASE_URL = originalDbUrl;
      }
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("renders modular dashboard HTML with all section tabs, tables, and dialogs", () => {
    const html = renderDashboardHtml();
    assert.ok(html.includes("Scrapling Monitor"));
    assert.ok(html.includes('id="tab-home"'));
    assert.ok(html.includes('id="tab-eneba"'));
    assert.ok(html.includes('id="tab-scraping"'));
    assert.ok(html.includes('id="tab-config"'));
    assert.ok(html.includes('id="providersTable"'));
    assert.ok(html.includes('id="enebaSummaryTable"'));
    assert.ok(html.includes('id="enebaDealsTable"'));
    assert.ok(html.includes('id="pagesTable"'));
    assert.ok(html.includes('id="configTable"'));
    assert.ok(html.includes('id="offersTable"'));
    assert.ok(html.includes('id="pageFormDialog"'));
    assert.ok(html.includes('id="cronFormDialog"'));
    assert.ok(html.includes('id="emailPreviewDialog"'));
    assert.ok(html.includes('id="sellerOffersDialog"'));
    assert.ok(html.includes('id="scrapeBanner"'));
    assert.ok(html.includes('id="toast"'));
  });

  it("exposes Express application, handles 404s, and serves UI routes across paths", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "scrapling-express-"));
    const tmpEnvPath = path.join(tmpDir, ".env");
    fs.writeFileSync(
      tmpEnvPath,
      "PORT=80\nDATABASE_URL=postgresql://mock:mock@127.0.0.1:1/postgres\n",
      "utf8",
    );

    const { pool } = createInMemoryConfigPool();
    const app = await createDashboardServer({
      port: 0,
      dataDir: path.join(tmpDir, "data"),
      envPath: tmpEnvPath,
      pool,
    });

    try {
      assert.ok(app.app);
      const base = `http://127.0.0.1:${app.port}`;

      // Check all UI routes
      for (const route of ["/", "/eneba", "/scraping", "/config"]) {
        const res = await fetch(`${base}${route}`);
        assert.equal(res.status, 200);
        assert.equal(
          res.headers.get("content-type"),
          "text/html; charset=utf-8",
        );
        const text = await res.text();
        assert.ok(text.includes("Scrapling Monitor"));
      }

      // Check 404 response
      const notFoundRes = await fetch(`${base}/api/unknown-endpoint`);
      assert.equal(notFoundRes.status, 404);
      const notFoundData = await notFoundRes.json();
      assert.deepEqual(notFoundData, { error: "Not found" });
    } finally {
      await app.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
