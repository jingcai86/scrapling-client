import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ENV_SCHEMA,
  RandomizedDailyScheduler,
  deleteEnvKey,
  ensureDefaultEnvKeys,
  filterAlertableDeals,
  getEmailConfigStatus,
  loadEnv,
  readEnvValues,
  renderDealAlertEmailTemplate,
  resolveEnvFilePath,
  sendDealAlertEmail,
  updateEnvValues,
  type DealAlertItem,
} from "../core/index.js";
import { PageStore } from "./pageStore.js";
import { ScrapeRunner, statusesToAlertItems } from "./scrapeRunner.js";
import { searchDeals, type DealSearchQuery } from "./dealSearch.js";
import { renderDashboardHtml } from "./ui.js";

const SAMPLE_PREVIEW_DEALS: DealAlertItem[] = [
  {
    provider: "eneba",
    category: "Nintendo eShop Gift Cards",
    title: "Nintendo eShop Card 70 USD Key UNITED STATES",
    url: "https://www.eneba.com/us/nintendo-nintendo-eshop-card-70-usd-key-united-states",
    region: "United States",
    sellingPrice: 54.6,
    originalPrice: 70,
    faceValue: 70,
    discountPct: 22,
    cashbackPct: 5,
    effectiveDiscountPct: 25.9,
    effectivePrice: 51.87,
    savingsAmount: 18.13,
    lowestSellerName: "GameDealPro",
    lowestSellerRating: 99.84,
  },
  {
    provider: "eneba",
    category: "PlayStation (PSN) Gift Cards",
    title: "PlayStation Network Card 100 USD (USA) PSN Key UNITED STATES",
    url: "https://www.eneba.com/us/psn-playstation-network-card-psn-100-usd-usa-psn-key-united-states",
    region: "United States",
    sellingPrice: 79.0,
    originalPrice: 100,
    faceValue: 100,
    discountPct: 21,
    cashbackPct: 0,
    effectiveDiscountPct: 21,
    effectivePrice: 79.0,
    savingsAmount: 21.0,
    lowestSellerName: "KeyVaultUS",
    lowestSellerRating: 99.52,
  },
];

async function readJsonBody(
  req: http.IncomingMessage,
): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw) as Record<string, unknown>;
}

function sendJson(
  res: http.ServerResponse,
  statusCode: number,
  payload: unknown,
): void {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

export interface ServerInstance {
  server: http.Server;
  pageStore: PageStore;
  runner: ScrapeRunner;
  scheduler: RandomizedDailyScheduler;
  port: number;
  close: () => Promise<void>;
}

export async function createDashboardServer(options: {
  port?: number;
  dataDir?: string;
  envPath?: string;
} = {}): Promise<ServerInstance> {
  loadEnv(options.envPath);
  ensureDefaultEnvKeys(options.envPath);

  const pageStore = new PageStore(options.dataDir);
  const runner = new ScrapeRunner(pageStore);
  await runner.hydrateFromDatabase();

  const scheduler = new RandomizedDailyScheduler(async () => {
    const results = await runner.runScrape();
    return `Scraped ${results.length} page(s) via daily randomized schedule.`;
  });

  const server = http.createServer(async (req, res) => {
    try {
      const parsedUrl = new URL(req.url || "/", "http://localhost");
      const pathname = parsedUrl.pathname;
      const method = req.method || "GET";

      // 1. Serve Dashboard UI
      if (method === "GET" && pathname === "/") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(renderDashboardHtml());
        return;
      }

      // 2. GET /api/dashboard
      if (method === "GET" && pathname === "/api/dashboard") {
        const pages = pageStore.listPages();
        const providers = Array.from(new Set(pages.map((p) => p.provider)));
        sendJson(res, 200, {
          pages,
          providers,
          statuses: runner.getLatestStatuses(),
          runner: runner.getState(),
          scheduler: scheduler.getState(),
          env: {
            schema: ENV_SCHEMA,
            values: readEnvValues(options.envPath),
            envFilePath: resolveEnvFilePath(options.envPath),
          },
        });
        return;
      }

      // 2.5 GET or POST /api/deals/search (and /api/deals) — Hermes & external deal search API
      if (
        (method === "GET" || method === "POST") &&
        (pathname === "/api/deals/search" || pathname === "/api/deals")
      ) {
        const sp = parsedUrl.searchParams;
        const body = method === "POST" ? await readJsonBody(req) : {};

        const getStr = (key: string): string | undefined => {
          const fromBody = body[key];
          if (fromBody !== undefined && fromBody !== null) {
            return String(fromBody);
          }
          const fromQuery = sp.get(key);
          return fromQuery !== null ? fromQuery : undefined;
        };

        const bestRaw = getStr("bestOnly") ?? getStr("best");
        const bestOnly =
          bestRaw !== undefined
            ? ["true", "1", "yes"].includes(bestRaw.toLowerCase())
            : false;

        const minDiscountRaw = getStr("minDiscount");
        const maxPriceRaw = getStr("maxPrice");
        const limitRaw = getStr("limit");

        const searchParams: DealSearchQuery = {
          q: getStr("q"),
          name: getStr("name"),
          query: getStr("query"),
          category: getStr("category"),
          provider: getStr("provider"),
          date: getStr("date"),
          timestamp: getStr("timestamp"),
          from: getStr("from"),
          since: getStr("since"),
          to: getStr("to"),
          until: getStr("until"),
          bestOnly,
          minDiscount:
            minDiscountRaw !== undefined ? Number(minDiscountRaw) : undefined,
          maxPrice: maxPriceRaw !== undefined ? Number(maxPriceRaw) : undefined,
          limit: limitRaw !== undefined ? Number(limitRaw) : undefined,
        };

        const result = await searchDeals(
          searchParams,
          runner.getLatestStatuses(),
        );
        sendJson(res, 200, result);
        return;
      }

      // 3. POST /api/pages (Add new scraping page)
      if (method === "POST" && pathname === "/api/pages") {
        const body = await readJsonBody(req);
        const page = pageStore.addPage({
          provider: String(body.provider ?? "eneba"),
          categoryName: String(body.categoryName ?? ""),
          url: String(body.url ?? ""),
          enabled: body.enabled !== undefined ? Boolean(body.enabled) : true,
          withOffers:
            body.withOffers !== undefined ? Boolean(body.withOffers) : true,
        });
        sendJson(res, 201, { page });
        return;
      }

      // 4. PATCH / DELETE /api/pages/:id
      if (pathname.startsWith("/api/pages/")) {
        const id = decodeURIComponent(pathname.slice("/api/pages/".length));
        if (method === "PATCH") {
          const body = await readJsonBody(req);
          const updated = pageStore.updatePage(id, {
            categoryName:
              body.categoryName !== undefined
                ? String(body.categoryName)
                : undefined,
            url: body.url !== undefined ? String(body.url) : undefined,
            provider:
              body.provider !== undefined ? String(body.provider) : undefined,
            enabled:
              body.enabled !== undefined ? Boolean(body.enabled) : undefined,
            withOffers:
              body.withOffers !== undefined
                ? Boolean(body.withOffers)
                : undefined,
          });
          if (!updated) {
            sendJson(res, 404, { error: "Page not found" });
            return;
          }
          sendJson(res, 200, { page: updated });
          return;
        }

        if (method === "DELETE") {
          const deleted = pageStore.deletePage(id);
          sendJson(res, deleted ? 200 : 404, { deleted });
          return;
        }
      }

      // 5. POST /api/scrape (Trigger async scrape run)
      if (method === "POST" && pathname === "/api/scrape") {
        if (runner.getState().isScraping) {
          sendJson(res, 409, { error: "A scrape job is already running." });
          return;
        }
        const body = await readJsonBody(req);
        const pageId = body.pageId ? String(body.pageId) : undefined;
        const withOffersOverride =
          body.withOffers !== undefined ? Boolean(body.withOffers) : undefined;

        // Run asynchronously so UI can poll live status
        void runner
          .runScrape({ pageId, withOffersOverride })
          .catch(() => undefined);

        sendJson(res, 202, {
          started: true,
          runner: runner.getState(),
        });
        return;
      }

      // 6. PUT /api/env (Update .env values)
      if (method === "PUT" && pathname === "/api/env") {
        const body = await readJsonBody(req);
        const rawUpdates = (body.updates ?? {}) as Record<string, unknown>;
        const cleanUpdates: Record<string, string> = {};
        for (const [k, v] of Object.entries(rawUpdates)) {
          cleanUpdates[k] = String(v ?? "");
        }
        const values = updateEnvValues(cleanUpdates, options.envPath);
        if (
          "CRON_ENABLED" in cleanUpdates ||
          "CRON_BASE_TIME" in cleanUpdates ||
          "CRON_JITTER_MINUTES" in cleanUpdates
        ) {
          scheduler.reloadFromEnv();
        }
        sendJson(res, 200, {
          values,
          scheduler: scheduler.getState(),
        });
        return;
      }

      // 7. DELETE /api/env/:key
      if (method === "DELETE" && pathname.startsWith("/api/env/")) {
        const key = decodeURIComponent(pathname.slice("/api/env/".length));
        const values = deleteEnvKey(key, options.envPath);
        sendJson(res, 200, { values });
        return;
      }

      // 8. PUT /api/scheduler (Update randomized daily cron config or re-roll offset)
      if (method === "PUT" && pathname === "/api/scheduler") {
        const body = await readJsonBody(req);
        if (body.reroll) {
          sendJson(res, 200, { scheduler: scheduler.rerollNextRun() });
          return;
        }
        const state = scheduler.updateConfig({
          enabled:
            body.enabled !== undefined ? Boolean(body.enabled) : undefined,
          baseTime:
            body.baseTime !== undefined ? String(body.baseTime) : undefined,
          jitterMinutes:
            body.jitterMinutes !== undefined
              ? Number(body.jitterMinutes)
              : undefined,
        });
        sendJson(res, 200, { scheduler: state });
        return;
      }

      // 9. GET /api/email/preview (Preview Resend email template for >= threshold % deals)
      if (method === "GET" && pathname === "/api/email/preview") {
        const thresholdPct =
          Number(process.env.ALERT_DISCOUNT_THRESHOLD_PCT ?? "20") || 20;
        const liveItems = statusesToAlertItems(runner.getLatestStatuses());
        const matchingLive = filterAlertableDeals(liveItems, thresholdPct);
        const dealsForPreview =
          matchingLive.length > 0 ? matchingLive : SAMPLE_PREVIEW_DEALS;

        const template = renderDealAlertEmailTemplate(dealsForPreview, {
          thresholdPct,
        });
        sendJson(res, 200, {
          ...template,
          isSampleData: matchingLive.length === 0,
        });
        return;
      }

      // 10. POST /api/email/test (Send test alert email via Resend)
      if (method === "POST" && pathname === "/api/email/test") {
        const thresholdPct =
          Number(process.env.ALERT_DISCOUNT_THRESHOLD_PCT ?? "20") || 20;
        const liveItems = statusesToAlertItems(runner.getLatestStatuses());
        const matchingLive = filterAlertableDeals(liveItems, thresholdPct);
        const dealsToSend =
          matchingLive.length > 0 ? matchingLive : SAMPLE_PREVIEW_DEALS;

        const result = await sendDealAlertEmail(dealsToSend, {
          force: true,
          thresholdPct,
        });
        sendJson(res, 200, result);
        return;
      }

      sendJson(res, 404, { error: "Not found" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 500, { error: message });
    }
  });

  const requestedPort =
    options.port ?? (Number(process.env.PORT ?? "3000") || 3000);

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(requestedPort, () => resolve());
  });

  const addr = server.address();
  const actualPort =
    typeof addr === "object" && addr ? addr.port : requestedPort;

  return {
    server,
    pageStore,
    runner,
    scheduler,
    port: actualPort,
    close: async () => {
      scheduler.stop();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

const isMain =
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const instance = await createDashboardServer();
  const sched = instance.scheduler.getState();
  const emailStatus = getEmailConfigStatus();
  console.log("=".repeat(76));
  console.log(
    `🚀 Scrapling Deal Monitor Server running at http://localhost:${instance.port}`,
  );
  console.log(
    `⏰ Daily Randomized Cron: ${sched.enabled ? `${sched.baseTime} + 0..${sched.jitterMinutes}m jitter (Next: ${sched.nextRunAt ? new Date(sched.nextRunAt).toLocaleString() : "N/A"})` : "Disabled"}`,
  );
  if (emailStatus.warningMessage) {
    console.warn(`⚠️  [Email Warning] ${emailStatus.warningMessage}`);
  } else {
    console.log(
      `✉️  Resend Email Alerts: Enabled (threshold >= ${emailStatus.thresholdPct}% off)`,
    );
  }
  console.log("=".repeat(76));
}
