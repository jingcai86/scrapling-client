import type pg from "pg";
import type { RandomizedDailyScheduler, MultiSchedulerManager } from "../core/index.js";
import type { TargetStore } from "./services/targetStore.js";
import type { ScrapeRunner } from "./services/scrapeRunner.js";

export interface ServerContext {
  targetStore?: TargetStore;
  pageStore: TargetStore;
  runner: ScrapeRunner;
  scheduler: RandomizedDailyScheduler;
  schedulerManager: MultiSchedulerManager;
  pool?: pg.Pool;
  envPath?: string;
}
