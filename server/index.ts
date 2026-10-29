import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type express from "express";
import type pg from "pg";
import {
  RandomizedDailyScheduler,
  MultiSchedulerManager,
  createPgPool,
  ensureDefaultEnvKeys,
  getEmailConfigStatus,
  initScraplingConfigOnStartup,
  syncSchedulersAndTargetsOnStartup,
  loadEnv,
} from "../core/index.js";
import { ensureEnebaSchema } from "../eneba/db.js";
import { createApp } from "./app.js";
import { PageStore } from "./services/pageStore.js";
import { ScrapeRunner } from "./services/scrapeRunner.js";

export interface ServerInstance {
  server: http.Server;
  app: express.Express;
  pageStore: PageStore;
  runner: ScrapeRunner;
  scheduler: RandomizedDailyScheduler;
  schedulerManager: MultiSchedulerManager;
  port: number;
  close: () => Promise<void>;
}

export async function createDashboardServer(options: {
  port?: number;
  dataDir?: string;
  envPath?: string;
  pool?: pg.Pool;
} = {}): Promise<ServerInstance> {
  loadEnv(options.envPath);
  ensureDefaultEnvKeys(options.envPath);

  const pageStore = new PageStore(options.dataDir);

  // Mandatory startup check: Ensure PostgreSQL is reachable and initialize `scrapling` schema and tables.
  // Fails fast if DATABASE_URL is missing or PostgreSQL is unreachable.
  const appPool = options.pool ?? createPgPool();
  try {
    await initScraplingConfigOnStartup({
      pool: appPool,
      envPath: options.envPath,
    });
    await ensureEnebaSchema(appPool);

    // Sync schedulers and scrape targets with PostgreSQL
    try {
      const initialPages = pageStore.listPages();
      const initialTargets = initialPages.map((p) => ({
        id: p.id,
        category: p.category || p.provider || "eneba",
        name: p.categoryName || p.name || p.id,
        url: p.url,
        enabled: p.enabled,
        withOffers: p.withOffers,
        scheduleId: p.scheduleId || "default",
        createdAt: p.createdAt,
      }));
      const synced = await syncSchedulersAndTargetsOnStartup({
        pool: appPool,
        initialSchedulers: pageStore.listSchedules(),
        initialTargets,
      });
      pageStore.saveSchedules(synced.schedulers);
      pageStore.savePages(
        synced.targets.map((t) => {
          const provider = t.provider || t.category || "eneba";
          return {
            id: t.id,
            productId: t.productId,
            productSlug: t.productSlug,
            productTitle: t.productTitle,
            category: provider,
            provider,
            categoryName: t.name,
            name: t.name,
            url: t.url || "",
            enabled: t.enabled,
            withOffers: t.withOffers,
            scheduleId: t.scheduleId || "default",
            createdAt: t.createdAt || new Date().toISOString(),
          };
        }),
      );
    } catch (syncErr) {
      console.warn("[PostgreSQL Warn] Could not sync schedulers/targets on startup:", syncErr);
    }
  } catch (err) {
    if (!options.pool) {
      await appPool.end().catch(() => {});
    }
    throw err;
  }

  const runner = new ScrapeRunner(pageStore);
  await runner.hydrateFromDatabase();

  const initialSchedules = pageStore.listSchedules();
  const schedulerManager = new MultiSchedulerManager(
    async (sId: string) => {
      const results = await runner.runScrape({ scheduleId: sId });
      return `Scraped ${results.length} page(s) via schedule "${sId}".`;
    },
    {
      initialSchedules,
      getLastScrapeTime: (sId?: string) => runner.getLatestScrapeTime(sId),
    },
  );

  const defaultScheduler =
    schedulerManager.getScheduler("default") ||
    new RandomizedDailyScheduler(
      async () => {
        const results = await runner.runScrape();
        return `Scraped ${results.length} page(s) via daily randomized schedule.`;
      },
      {
        getLastScrapeTime: () => runner.getLatestScrapeTime("default"),
      },
    );

  // When a scheduled scrape completes, advance only that specific schedule to the next day
  runner.onScrapeComplete((_statuses, meta) => {
    if (meta?.scheduleId) {
      schedulerManager.recordRunCompleted(meta.scheduleId, new Date());
    }
  });

  const app = createApp({
    pageStore,
    runner,
    scheduler: defaultScheduler,
    schedulerManager,
    pool: appPool,
    envPath: options.envPath,
  });

  const server = http.createServer(app);

  const requestedPort =
    options.port ?? (Number(process.env.PORT ?? "80") || 80);

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(requestedPort, () => resolve());
  });

  const addr = server.address();
  const actualPort =
    typeof addr === "object" && addr ? addr.port : requestedPort;

  return {
    server,
    app,
    pageStore,
    runner,
    scheduler: defaultScheduler,
    schedulerManager,
    port: actualPort,
    close: async () => {
      schedulerManager.stopAll();
      defaultScheduler.stop();
      if (!options.pool) {
        await appPool.end().catch(() => {});
      }
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

const isMain =
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    const instance = await createDashboardServer();
    const sched = instance.scheduler.getState();
    const emailStatus = getEmailConfigStatus();
    console.log("=".repeat(76));
    console.log(
      `🚀 Scrapling Monitor Server running at http://localhost:${instance.port}`,
    );
    console.log(
      `🗄️  PostgreSQL Schema Ready: "scrapling" (products, scrape_runs, records, sellers, schedulers, scrape_targets, config)`,
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
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `❌ [Fatal Startup Error] Failed to initialize database (scrapling schema): ${message}`,
    );
    process.exit(1);
  }
}
