import type pg from "pg";
import type { RandomizedDailyScheduler } from "../core/index.js";
import type { PageStore } from "./services/pageStore.js";
import type { ScrapeRunner } from "./services/scrapeRunner.js";

export interface ServerContext {
  pageStore: PageStore;
  runner: ScrapeRunner;
  scheduler: RandomizedDailyScheduler;
  pool?: pg.Pool;
  envPath?: string;
}
