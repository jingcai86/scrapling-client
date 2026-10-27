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

function createInMemoryConfigPool(): {
  pool: pg.Pool;
  configRows: Map<string, { key: string; value: string }>;
  enebaConfigRows: Map<string, { key: string; value: string }>;
  scheduleRows: Map<string, any>;
  pageRows: Map<string, any>;
} {
  const configRows = new Map<string, { key: string; value: string }>();
  const enebaConfigRows = new Map<string, { key: string; value: string }>();
  configRows.set("top_deals_limit", { key: "top_deals_limit", value: "10" });
  configRows.set("alert_discount_threshold_pct", { key: "alert_discount_threshold_pct", value: "20" });
  enebaConfigRows.set("top_deals_limit", { key: "top_deals_limit", value: "10" });
  enebaConfigRows.set("alert_discount_threshold_pct", { key: "alert_discount_threshold_pct", value: "20" });
  const scheduleRows = new Map<string, any>();
  const pageRows = new Map<string, any>();

  const pool = {
    query: async (
      sqlOrConfig: string | { text: string; values?: unknown[]; rowMode?: string },
      params: unknown[] = [],
    ) => {
      const sqlText =
        typeof sqlOrConfig === "object" && sqlOrConfig !== null
          ? sqlOrConfig.text
          : String(sqlOrConfig);
      const sqlParams =
        (typeof sqlOrConfig === "object" &&
          sqlOrConfig !== null &&
          Array.isArray(sqlOrConfig.values) &&
          sqlOrConfig.values) ||
        params ||
        [];
      const isArrayMode =
        typeof sqlOrConfig === "object" &&
        sqlOrConfig !== null &&
        sqlOrConfig.rowMode === "array";

      const normalized = sqlText
        .replace(/"/g, "")
        .replace(/\s+/g, " ")
        .trim();
      const lower = normalized.toLowerCase();

      // Schedulers table queries (scrapling.schedulers)
      if (lower.includes("scrapling.schedulers") || lower.includes("scrapling.schedules")) {
        if (lower.includes("insert into") || lower.includes("on conflict")) {
          const id = String(sqlParams[0] ?? "");
          const name = String(sqlParams[1] ?? "");
          const base_time = String(sqlParams[2] ?? "19:00");
          const jitter_minutes = Number(sqlParams[3] ?? 60);
          const enabled = Boolean(sqlParams[4]);
          const created_at = sqlParams[5] ? new Date(String(sqlParams[5])) : new Date();
          if (id) {
            scheduleRows.set(id, { id, name, base_time, jitter_minutes, enabled, created_at });
          }
          return { rows: [], rowCount: 1 };
        }
        if (lower.startsWith("select")) {
          const rows = Array.from(scheduleRows.values());
          return { rows, rowCount: rows.length };
        }
        if (lower.startsWith("delete from")) {
          const id = String(sqlParams[0] ?? "");
          scheduleRows.delete(id);
          return { rows: [], rowCount: 1 };
        }
      }

      // Scraping Targets table queries (scrapling.targets)
      if (lower.includes("scrapling.targets") || lower.includes("scrapling.scrape_pages")) {
        if (lower.includes("insert into") || lower.includes("on conflict")) {
          const id = String(sqlParams[0] ?? "");
          const category = String(sqlParams[1] ?? "eneba");
          const name = String(sqlParams[2] ?? "");
          const url = String(sqlParams[3] ?? "");
          const enabled = Boolean(sqlParams[4]);
          const with_offers = Boolean(sqlParams[5]);
          const schedule_id = String(sqlParams[6] ?? "default");
          const created_at = sqlParams[7] ? new Date(String(sqlParams[7])) : new Date();
          if (id) {
            pageRows.set(id, { id, category, name, url, enabled, with_offers, schedule_id, created_at });
          }
          return { rows: [], rowCount: 1 };
        }
        if (lower.startsWith("select")) {
          const rows = Array.from(pageRows.values());
          return { rows, rowCount: rows.length };
        }
        if (lower.startsWith("delete from")) {
          const id = String(sqlParams[0] ?? "");
          pageRows.delete(id);
          return { rows: [], rowCount: 1 };
        }
        if (lower.startsWith("update")) {
          return { rows: [], rowCount: 1 };
        }
      }

      if (
        lower.includes("scrapling.config") &&
        lower.includes("do nothing")
      ) {
        const key = String(sqlParams[0] ?? "");
        const value = String(sqlParams[1] ?? "");
        if (key && !configRows.has(key)) {
          configRows.set(key, { key, value });
          if (key === "top_deals_limit" || key === "alert_discount_threshold_pct") {
            enebaConfigRows.set(key, { key, value });
          }
        }
        return { rows: [], rowCount: 1 };
      }

      if (
        lower.includes("scrapling.config") &&
        lower.includes("do update")
      ) {
        const key = String(sqlParams[0] ?? "");
        const value = String(sqlParams[4] ?? sqlParams[1] ?? "");
        if (key) {
          configRows.set(key, { key, value });
          if (key === "top_deals_limit" || key === "alert_discount_threshold_pct") {
            enebaConfigRows.set(key, { key, value });
          }
        }
        return { rows: [], rowCount: 1 };
      }

      if (
        lower.startsWith("select") &&
        lower.includes("scrapling.config") &&
        lower.includes("order by")
      ) {
        const rows = Array.from(configRows.values()).sort((a, b) =>
          a.key.localeCompare(b.key),
        );
        return {
          rows: isArrayMode ? rows.map((r) => [r.key, r.value]) : rows,
          rowCount: rows.length,
        };
      }

      if (
        lower.startsWith("update scrapling.config") &&
        lower.includes("where")
      ) {
        const key = String(sqlParams[1] ?? sqlParams[0] ?? "");
        if (configRows.has(key)) {
          configRows.set(key, { key, value: "" });
        }
        return { rows: [], rowCount: 1 };
      }

      if (lower.startsWith("delete from scrapling.config where")) {
        const key = String(sqlParams[0] ?? "");
        configRows.delete(key);
        return { rows: [], rowCount: 1 };
      }

      // Eneba configuration table queries
      if (
        lower.includes("scrapling.eneba_config") &&
        lower.includes("do nothing")
      ) {
        const key = String(sqlParams[0] ?? "top_deals_limit");
        const value = String(sqlParams[1] ?? "10");
        if (!enebaConfigRows.has(key)) {
          enebaConfigRows.set(key, { key, value });
        }
        return { rows: [], rowCount: 1 };
      }

      if (
        lower.includes("scrapling.eneba_config") &&
        lower.includes("do update")
      ) {
        const key = String(sqlParams[0] ?? "");
        const value = String(sqlParams[3] ?? sqlParams[1] ?? "");
        if (key) {
          enebaConfigRows.set(key, { key, value });
        }
        return { rows: [], rowCount: 1 };
      }

      if (
        lower.startsWith("select") &&
        lower.includes("scrapling.eneba_config") &&
        lower.includes("order by")
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
        return {
          rows: isArrayMode ? rows.map((r) => [r.key, r.value]) : rows,
          rowCount: rows.length,
        };
      }

      return { rows: [], rowCount: 0 };
    },
    end: async () => undefined,
  } as unknown as pg.Pool;

  return { pool, configRows, enebaConfigRows, scheduleRows, pageRows };
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

    // Once-daily rule: If a scrape already ran today, next run MUST be scheduled for tomorrow
    const scrapedTodayAt = new Date("2026-10-25T19:15:00");
    const currentNow = new Date("2026-10-25T19:41:00");
    const nextDayRoll = computeNextRandomizedRun(
      "19:00",
      60,
      currentNow,
      false,
      () => 0.5,
      scrapedTodayAt,
    );
    assert.equal(nextDayRoll.nextRun.getDate(), 26); // Oct 26 (tomorrow)
    assert.equal(nextDayRoll.nextRun.getHours(), 19);
    assert.equal(nextDayRoll.nextRun.getMinutes(), 30);
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

    const { pool, configRows, enebaConfigRows, scheduleRows, pageRows } = createInMemoryConfigPool();

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
            ALERT_EMAIL_TO: "alerts@example.com",
          },
        }),
      });
      assert.equal(envRes.status, 200);
      const envUpdated = (await envRes.json()) as {
        values: Record<string, string>;
      };
      assert.equal(envUpdated.values.ALERT_EMAIL_TO, "alerts@example.com");
      // PORT and DATABASE_URL must remain unchanged from .env
      assert.equal(envUpdated.values.PORT, "80");
      assert.equal(
        envUpdated.values.DATABASE_URL,
        "postgresql://mock:mock@127.0.0.1:1/postgres",
      );
      // Confirm updates went to scrapling.config
      assert.equal(configRows.get("ALERT_EMAIL_TO")?.value, "alerts@example.com");

      // 4b. PUT /api/scheduler/default (Update primary schedule stored in scrapling.schedulers)
      const updateDefaultRes = await fetch(`${baseUrl}/api/scheduler/default`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseTime: "20:00",
          jitterMinutes: 45,
        }),
      });
      assert.equal(updateDefaultRes.status, 200);
      const defData = (await updateDefaultRes.json()) as {
        scheduler: { baseTime: string; jitterMinutes: number };
      };
      assert.equal(defData.scheduler.baseTime, "20:00");
      assert.equal(defData.scheduler.jitterMinutes, 45);
      assert.equal(scheduleRows.get("default")?.base_time, "20:00");
      assert.equal(scheduleRows.get("default")?.jitter_minutes, 45);

      // 5. GET /api/email/preview
      const prevRes = await fetch(`${baseUrl}/api/email/preview`);
      assert.equal(prevRes.status, 200);
      const prev = (await prevRes.json()) as { html: string; subject: string };
      assert.match(prev.html, /Scrapling Monitor Alert/);

      // 5.1 POST /api/email/test with custom recipient
      const testEmailRes = await fetch(`${baseUrl}/api/email/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: "custom-tester@example.com" }),
      });
      assert.equal(testEmailRes.status, 200);
      const testEmailData = (await testEmailRes.json()) as { sent: boolean };
      assert.ok("sent" in testEmailData);

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
          averageEffectiveDiscountPct: 8,
          maxDiscountPct: 10,
          maxEffectiveDiscountPct: 10,
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
              cashbackPct: 0,
              inStock: true,
              discountPct: 10,
              effectiveDiscountPct: 10,
              effectivePrice: 90,
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
        assert.equal(searchData.bestDeal.effectiveDiscountPct, 10);
      } finally {
        await app2.close();
      }

      // 7. Multi-Scheduler API and Category Schedule Assignment
      // 7.1 GET /api/scheduler returns scheduler and schedulers array
      const schedRes = await fetch(`${baseUrl}/api/scheduler`);
      assert.equal(schedRes.status, 200);
      const schedData = (await schedRes.json()) as {
        scheduler: { id?: string; baseTime: string };
        schedulers: Array<{ id: string; name: string }>;
      };
      assert.ok(Array.isArray(schedData.schedulers));
      assert.equal(schedData.schedulers.length, 1);
      assert.equal(schedData.schedulers[0].id, "default");

      // 7.2 POST /api/scheduler creates a new schedule
      const createSchedRes = await fetch(`${baseUrl}/api/scheduler`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Hourly Off-Peak",
          baseTime: "03:00",
          jitterMinutes: 30,
          enabled: true,
        }),
      });
      assert.equal(createSchedRes.status, 201);
      const createdSched = (await createSchedRes.json()) as {
        scheduler: { id: string; name: string; baseTime: string };
      };
      assert.equal(createdSched.scheduler.name, "Hourly Off-Peak");
      assert.equal(createdSched.scheduler.baseTime, "03:00");
      const newSchedId = createdSched.scheduler.id;

      // Verify schedule was persisted to PostgreSQL scrapling.schedules
      assert.ok(scheduleRows.has(newSchedId));
      assert.equal(scheduleRows.get(newSchedId).name, "Hourly Off-Peak");

      // 7.3 PUT /api/pages/:id/schedule assigns an Eneba category page to the new schedule
      const testTargetPage = dash.pages.find((p) => p.categoryName.toLowerCase().includes("apple")) || dash.pages[0];
      const testTargetPageId = testTargetPage.id;

      const assignRes = await fetch(
        `${baseUrl}/api/pages/${encodeURIComponent(testTargetPageId)}/schedule`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scheduleId: newSchedId }),
        },
      );
      assert.equal(assignRes.status, 200);
      const assignedPage = (await assignRes.json()) as {
        page: { id: string; scheduleId: string };
      };
      assert.equal(assignedPage.page.id, testTargetPageId);
      assert.equal(assignedPage.page.scheduleId, newSchedId);

      // Verify page was updated in PostgreSQL scrapling.scrape_pages
      assert.equal(pageRows.get(testTargetPageId)?.schedule_id, newSchedId);

      // Verify dashboard reflects schedulers and assigned pages
      const dashCheck = await fetch(`${baseUrl}/api/dashboard`);
      const dashJson = (await dashCheck.json()) as {
        schedulers: Array<{ id: string; assignedPageIds?: string[] }>;
        pages: Array<{ id: string; scheduleId?: string }>;
      };
      const applePage = dashJson.pages.find((p) => p.id === testTargetPageId);
      assert.equal(applePage?.scheduleId, newSchedId);
      const customSched = dashJson.schedulers.find((s) => s.id === newSchedId);
      assert.ok(customSched?.assignedPageIds?.includes(testTargetPageId));

      // 7.4 DELETE /api/scheduler/:id deletes the schedule and reassigns pages to default
      const deleteSchedRes = await fetch(
        `${baseUrl}/api/scheduler/${encodeURIComponent(newSchedId)}`,
        { method: "DELETE" },
      );
      assert.equal(deleteSchedRes.status, 200);

      // Verify schedule was removed from PostgreSQL scrapling.schedules
      assert.equal(scheduleRows.has(newSchedId), false);

      // Verify apple page reverted to default
      const dashAfterDel = await fetch(`${baseUrl}/api/dashboard`);
      const dashAfterJson = (await dashAfterDel.json()) as {
        pages: Array<{ id: string; scheduleId?: string }>;
      };
      const appleAfter = dashAfterJson.pages.find((p) => p.id === testTargetPageId);
      assert.equal(appleAfter?.scheduleId, "default");
    } finally {
      await app.close();
      if (originalDbUrl !== undefined) {
        process.env.DATABASE_URL = originalDbUrl;
      }
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("serves Angular SPA dashboard application shell across all navigation routes", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "scrapling-angular-"));
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

      for (const route of ["/", "/eneba", "/scraping", "/config"]) {
        const res = await fetch(`${base}${route}`);
        assert.equal(res.status, 200);
        assert.ok(
          res.headers.get("content-type")?.toLowerCase().includes("text/html"),
        );
        const text = await res.text();
        assert.ok(
          text.includes("<app-root") || text.includes("Scrapling Monitor"),
        );
      }
    } finally {
      await app.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
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
        assert.ok(
          res.headers.get("content-type")?.toLowerCase().includes("text/html"),
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
