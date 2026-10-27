import { loadEnv, updateEnvValues } from "./env.js";

export interface SchedulerConfig {
  id?: string;
  name?: string;
  enabled: boolean;
  baseTime: string; // "HH:MM" in 24h format, e.g. "19:00"
  jitterMinutes: number; // e.g. 60 -> random offset in [0, 60] minutes
}

export interface SchedulerState extends SchedulerConfig {
  id: string;
  name: string;
  chosenOffsetMinutes: number;
  chosenOffsetSeconds: number;
  windowStartIso: string | null;
  windowEndIso: string | null;
  nextRunAt: string | null;
  isRunningJob: boolean;
  lastRunAt: string | null;
  lastRunStatus: "idle" | "running" | "success" | "error";
  lastRunSummary: string | null;
  assignedPageIds?: string[];
}

export interface ScheduleItemConfig {
  id: string;
  name: string;
  enabled: boolean;
  baseTime: string;
  jitterMinutes: number;
}

/**
 * Checks if two dates fall on the same local calendar day.
 */
export function isSameCalendarDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

/**
 * Parses a "HH:MM" 24-hour string into `{ hours, minutes }`. Defaults to 19:00 (7:00 PM) if invalid.
 */
export function parseBaseTime(baseTime: string): {
  hours: number;
  minutes: number;
  normalized: string;
} {
  const match = String(baseTime ?? "")
    .trim()
    .match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return { hours: 19, minutes: 0, normalized: "19:00" };
  }
  const hours = Math.min(23, Math.max(0, Number(match[1])));
  const minutes = Math.min(59, Math.max(0, Number(match[2])));
  const normalized = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  return { hours, minutes, normalized };
}

/**
 * Computes the next scheduled timestamp given a base time ("19:00") and a random jitter window in minutes (e.g. 60).
 * Adheres strictly to the once-daily scraping rule: if a scrape has already completed today, the next run
 * is guaranteed to be scheduled for the next calendar day.
 */
export function computeNextRandomizedRun(
  baseTime: string,
  jitterMinutes: number,
  now: Date = new Date(),
  forceTomorrow = false,
  randomFn: () => number = Math.random,
  lastRunAt?: Date | string | null,
): {
  windowStart: Date;
  windowEnd: Date;
  nextRun: Date;
  chosenOffsetMinutes: number;
  chosenOffsetSeconds: number;
} {
  const { hours, minutes } = parseBaseTime(baseTime);
  const safeJitter = Math.max(0, Math.min(720, Math.floor(jitterMinutes || 0)));
  const maxSeconds = safeJitter * 60;
  const randomTotalSeconds =
    maxSeconds > 0 ? Math.floor(randomFn() * (maxSeconds + 1)) : 0;

  // Once-daily rule: If already scraped today (or within the last 12 hours), the next run must be tomorrow
  let alreadyScrapedToday = forceTomorrow;
  if (!alreadyScrapedToday && lastRunAt) {
    const lastDate =
      typeof lastRunAt === "string" ? new Date(lastRunAt) : lastRunAt;
    if (!isNaN(lastDate.getTime())) {
      if (
        isSameCalendarDay(lastDate, now) ||
        (now.getTime() - lastDate.getTime() < 12 * 60 * 60 * 1000 &&
          lastDate.getTime() <= now.getTime())
      ) {
        alreadyScrapedToday = true;
      }
    }
  }

  const candidateWindowStart = new Date(now.getTime());
  candidateWindowStart.setHours(hours, minutes, 0, 0);

  let candidateNextRun = new Date(
    candidateWindowStart.getTime() + randomTotalSeconds * 1000,
  );

  // If already scraped today, forced to tomorrow, or candidate time for today has already passed:
  if (alreadyScrapedToday || candidateNextRun.getTime() <= now.getTime() + 1000) {
    candidateWindowStart.setDate(candidateWindowStart.getDate() + 1);
    candidateWindowStart.setHours(hours, minutes, 0, 0);
    candidateNextRun = new Date(
      candidateWindowStart.getTime() + randomTotalSeconds * 1000,
    );
  }

  const candidateWindowEnd = new Date(
    candidateWindowStart.getTime() + safeJitter * 60 * 1000,
  );

  return {
    windowStart: candidateWindowStart,
    windowEnd: candidateWindowEnd,
    nextRun: candidateNextRun,
    chosenOffsetMinutes: Math.floor(randomTotalSeconds / 60),
    chosenOffsetSeconds: randomTotalSeconds % 60,
  };
}

export class RandomizedDailyScheduler {
  readonly id: string;
  name: string;
  private timer: NodeJS.Timeout | null = null;
  private enabled = true;
  private baseTime = "19:00";
  private jitterMinutes = 60;
  private chosenOffsetMinutes = 0;
  private chosenOffsetSeconds = 0;
  private windowStartIso: string | null = null;
  private windowEndIso: string | null = null;
  private nextRunAt: string | null = null;
  private isRunningJob = false;
  private lastRunAt: string | null = null;
  private lastRunStatus: "idle" | "running" | "success" | "error" = "idle";
  private lastRunSummary: string | null = null;
  private readonly jobCallback: (scheduleId: string) => Promise<string | void>;
  private readonly getLastScrapeTime?: () => Date | string | null | undefined;
  private readonly syncWithEnv: boolean;

  constructor(
    jobCallback: (scheduleId: string) => Promise<string | void>,
    options?: {
      id?: string;
      name?: string;
      getLastScrapeTime?: () => Date | string | null | undefined;
      lastRunAt?: Date | string | null;
      initialConfig?: Partial<SchedulerConfig>;
      syncWithEnv?: boolean;
    },
  ) {
    this.id = options?.id || "default";
    this.name = options?.name || "Daily Randomized Schedule";
    this.jobCallback = jobCallback;
    this.getLastScrapeTime = options?.getLastScrapeTime;
    this.syncWithEnv = options?.syncWithEnv ?? (this.id === "default");

    if (options?.lastRunAt) {
      const dt =
        typeof options.lastRunAt === "string"
          ? new Date(options.lastRunAt)
          : options.lastRunAt;
      if (!isNaN(dt.getTime())) {
        this.lastRunAt = dt.toISOString();
      }
    }

    if (options?.initialConfig) {
      if (options.initialConfig.name) this.name = options.initialConfig.name;
      if (options.initialConfig.enabled !== undefined) {
        this.enabled = Boolean(options.initialConfig.enabled);
      }
      if (options.initialConfig.baseTime) {
        this.baseTime = parseBaseTime(options.initialConfig.baseTime).normalized;
      }
      if (options.initialConfig.jitterMinutes !== undefined) {
        this.jitterMinutes = Math.max(
          0,
          Math.min(720, Math.floor(Number(options.initialConfig.jitterMinutes) || 0)),
        );
      }
      this.reschedule(false);
    } else if (this.syncWithEnv) {
      this.reloadFromEnv();
    } else {
      this.reschedule(false);
    }
  }

  /**
   * Reloads `CRON_ENABLED`, `CRON_BASE_TIME`, and `CRON_JITTER_MINUTES` from `.env` / `process.env`
   * and schedules the next randomized execution.
   */
  reloadFromEnv(): SchedulerState {
    if (this.syncWithEnv) {
      loadEnv();
      const rawEnabled = process.env.CRON_ENABLED?.trim() || "true";
      const enabled = rawEnabled.toLowerCase() !== "false";
      const { normalized } = parseBaseTime(
        process.env.CRON_BASE_TIME?.trim() || "19:00",
      );
      const rawJitter = process.env.CRON_JITTER_MINUTES?.trim() || "60";
      const jitter = Math.max(0, Math.min(720, Number(rawJitter) || 0));

      this.enabled = enabled;
      this.baseTime = normalized;
      this.jitterMinutes = jitter;
    }
    this.reschedule(false);
    return this.getState();
  }

  /**
   * Updates the scheduler settings in memory (`process.env`) and recalculates the next randomized run.
   */
  updateConfig(
    partial: Partial<SchedulerConfig>,
    persistToEnv = false,
  ): SchedulerState {
    if (partial.name !== undefined && partial.name.trim()) {
      this.name = partial.name.trim();
    }
    if (partial.enabled !== undefined) {
      this.enabled = Boolean(partial.enabled);
    }
    if (partial.baseTime !== undefined) {
      this.baseTime = parseBaseTime(partial.baseTime).normalized;
    }
    if (partial.jitterMinutes !== undefined) {
      this.jitterMinutes = Math.max(
        0,
        Math.min(720, Math.floor(Number(partial.jitterMinutes) || 0)),
      );
    }

    if (this.syncWithEnv) {
      process.env.CRON_ENABLED = String(this.enabled);
      process.env.CRON_BASE_TIME = this.baseTime;
      process.env.CRON_JITTER_MINUTES = String(this.jitterMinutes);

      if (persistToEnv) {
        updateEnvValues({
          CRON_ENABLED: String(this.enabled),
          CRON_BASE_TIME: this.baseTime,
          CRON_JITTER_MINUTES: String(this.jitterMinutes),
        });
      }
    }

    this.reschedule(false);
    return this.getState();
  }

  /**
   * Re-rolls a new random offset within `[0, jitterMinutes]` for the next scheduled window.
   */
  rerollNextRun(): SchedulerState {
    this.reschedule(false);
    return this.getState();
  }

  /**
   * Notifies scheduler that a scrape job just completed (e.g. manual button, batch, or cron).
   * Automatically advances the next scheduled run to the next calendar day.
   */
  recordRunCompleted(completedAt: Date | string = new Date()): void {
    const dt =
      typeof completedAt === "string" ? new Date(completedAt) : completedAt;
    this.lastRunAt = dt.toISOString();
    this.reschedule(true);
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private reschedule(forceTomorrow: boolean): void {
    this.clearTimer();
    if (!this.enabled) {
      this.nextRunAt = null;
      this.windowStartIso = null;
      this.windowEndIso = null;
      this.chosenOffsetMinutes = 0;
      this.chosenOffsetSeconds = 0;
      return;
    }

    const effectiveLastRun =
      this.lastRunAt || this.getLastScrapeTime?.() || null;
    const computed = computeNextRandomizedRun(
      this.baseTime,
      this.jitterMinutes,
      new Date(),
      forceTomorrow,
      Math.random,
      effectiveLastRun,
    );
    this.chosenOffsetMinutes = computed.chosenOffsetMinutes;
    this.chosenOffsetSeconds = computed.chosenOffsetSeconds;
    this.windowStartIso = computed.windowStart.toISOString();
    this.windowEndIso = computed.windowEnd.toISOString();
    this.nextRunAt = computed.nextRun.toISOString();

    const delayMs = Math.max(1000, computed.nextRun.getTime() - Date.now());
    this.timer = setTimeout(() => {
      void this.executeScheduledRun();
    }, delayMs);
    this.timer.unref?.();
  }

  private async executeScheduledRun(): Promise<void> {
    if (this.isRunningJob) {
      this.reschedule(true);
      return;
    }

    this.isRunningJob = true;
    this.lastRunStatus = "running";
    this.lastRunAt = new Date().toISOString();

    try {
      const summary = await this.jobCallback(this.id);
      this.lastRunStatus = "success";
      this.lastRunSummary = summary || `Scheduled scrape (${this.name}) completed.`;
    } catch (err) {
      this.lastRunStatus = "error";
      this.lastRunSummary =
        err instanceof Error ? err.message : String(err);
    } finally {
      this.isRunningJob = false;
      this.reschedule(true);
    }
  }

  stop(): void {
    this.clearTimer();
  }

  getState(): SchedulerState {
    return {
      id: this.id,
      name: this.name,
      enabled: this.enabled,
      baseTime: this.baseTime,
      jitterMinutes: this.jitterMinutes,
      chosenOffsetMinutes: this.chosenOffsetMinutes,
      chosenOffsetSeconds: this.chosenOffsetSeconds,
      windowStartIso: this.windowStartIso,
      windowEndIso: this.windowEndIso,
      nextRunAt: this.nextRunAt,
      isRunningJob: this.isRunningJob,
      lastRunAt: this.lastRunAt,
      lastRunStatus: this.lastRunStatus,
      lastRunSummary: this.lastRunSummary,
    };
  }
}

/**
 * Manages an array of independent RandomizedDailyScheduler instances,
 * routing each schedule to its target assigned pages.
 */
export class MultiSchedulerManager {
  private schedulers = new Map<string, RandomizedDailyScheduler>();
  private readonly jobCallback: (scheduleId: string) => Promise<string | void>;
  private readonly getLastScrapeTime?: (scheduleId: string) => Date | string | null | undefined;

  constructor(
    jobCallback: (scheduleId: string) => Promise<string | void>,
    options?: {
      initialSchedules?: ScheduleItemConfig[];
      getLastScrapeTime?: (scheduleId: string) => Date | string | null | undefined;
    },
  ) {
    this.jobCallback = jobCallback;
    this.getLastScrapeTime = options?.getLastScrapeTime;

    const initial =
      options?.initialSchedules && options.initialSchedules.length > 0
        ? options.initialSchedules
        : [
            {
              id: "default",
              name: "Primary Daily Schedule",
              enabled: true,
              baseTime: "19:00",
              jitterMinutes: 60,
            },
          ];

    for (const item of initial) {
      this.addOrUpdateSchedule(item);
    }
  }

  getScheduler(id: string): RandomizedDailyScheduler | undefined {
    return this.schedulers.get(id);
  }

  getStates(assignedPagesMap?: Record<string, string[]>): SchedulerState[] {
    const list: SchedulerState[] = [];
    for (const [id, sched] of this.schedulers.entries()) {
      const state = sched.getState();
      state.assignedPageIds = assignedPagesMap?.[id] || [];
      list.push(state);
    }
    return list;
  }

  getState(id: string, assignedPageIds?: string[]): SchedulerState | undefined {
    const s = this.schedulers.get(id);
    if (!s) return undefined;
    const state = s.getState();
    state.assignedPageIds = assignedPageIds || [];
    return state;
  }

  addOrUpdateSchedule(config: ScheduleItemConfig): SchedulerState {
    const existing = this.schedulers.get(config.id);
    if (existing) {
      existing.updateConfig({
        name: config.name,
        enabled: config.enabled,
        baseTime: config.baseTime,
        jitterMinutes: config.jitterMinutes,
      });
      return existing.getState();
    }

    const scheduler = new RandomizedDailyScheduler(
      async (sId) => this.jobCallback(sId),
      {
        id: config.id,
        name: config.name,
        initialConfig: config,
        syncWithEnv: config.id === "default",
        getLastScrapeTime: () => this.getLastScrapeTime?.(config.id),
      },
    );
    this.schedulers.set(config.id, scheduler);
    return scheduler.getState();
  }

  removeSchedule(id: string): boolean {
    if (id === "default") return false; // Default schedule cannot be deleted
    const existing = this.schedulers.get(id);
    if (existing) {
      existing.stop();
      this.schedulers.delete(id);
      return true;
    }
    return false;
  }

  reroll(id: string): SchedulerState | undefined {
    const s = this.schedulers.get(id);
    if (!s) return undefined;
    return s.rerollNextRun();
  }

  recordRunCompleted(scheduleId?: string, date: Date = new Date()): void {
    if (scheduleId && this.schedulers.has(scheduleId)) {
      this.schedulers.get(scheduleId)!.recordRunCompleted(date);
    } else {
      for (const s of this.schedulers.values()) {
        s.recordRunCompleted(date);
      }
    }
  }

  stopAll(): void {
    for (const s of this.schedulers.values()) {
      s.stop();
    }
  }
}
