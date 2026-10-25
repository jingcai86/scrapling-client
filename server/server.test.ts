import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  computeNextRandomizedRun,
  filterAlertableDeals,
  renderDealAlertEmailTemplate,
  type DealAlertItem,
} from "../core/index.js";
import { createDashboardServer } from "./index.js";

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

  it("serves dashboard API, manages scrape pages, and updates .env and scheduler settings", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "scrapling-srv-"));
    const tmpEnvPath = path.join(tmpDir, ".env");
    fs.writeFileSync(
      tmpEnvPath,
      "SCRAPLING_MCP_URL=http://localhost:8000/mcp\nCRON_BASE_TIME=19:00\nCRON_JITTER_MINUTES=60\n",
      "utf8",
    );

    const originalDbUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    const app = await createDashboardServer({
      port: 0,
      dataDir: path.join(tmpDir, "data"),
      envPath: tmpEnvPath,
    });

    try {
      const baseUrl = `http://127.0.0.1:${app.port}`;

      // 1. GET /api/dashboard
      const dashRes = await fetch(`${baseUrl}/api/dashboard`);
      assert.equal(dashRes.status, 200);
      const dash = (await dashRes.json()) as {
        pages: Array<{ id: string; categoryName: string }>;
        scheduler: { baseTime: string; jitterMinutes: number };
      };
      assert.equal(dash.pages.length, 5); // PlayStation, Nintendo, Android, Amazon, Apple
      assert.equal(dash.scheduler.baseTime, "19:00");
      assert.equal(dash.scheduler.jitterMinutes, 60);

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

      // 4. PUT /api/env (Update .env values)
      const envRes = await fetch(`${baseUrl}/api/env`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: {
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

      const diskEnv = fs.readFileSync(tmpEnvPath, "utf8");
      assert.match(diskEnv, /ALERT_DISCOUNT_THRESHOLD_PCT=25/);
      assert.match(diskEnv, /CRON_BASE_TIME=20:00/);
      assert.match(diskEnv, /CRON_JITTER_MINUTES=45/);

      // 5. GET /api/email/preview
      const prevRes = await fetch(`${baseUrl}/api/email/preview`);
      assert.equal(prevRes.status, 200);
      const prev = (await prevRes.json()) as { html: string; subject: string };
      assert.match(prev.html, /Scrapling Deal Monitor Alert/);
    } finally {
      await app.close();
      if (originalDbUrl !== undefined) {
        process.env.DATABASE_URL = originalDbUrl;
      }
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
