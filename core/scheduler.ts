import { loadEnv, updateEnvValues } from "./env.js";

export interface SchedulerConfig {
  enabled: boolean;
  baseTime: string; // "HH:MM" in 24h format, e.g. "19:00"
  jitterMinutes: number; // e.g. 60 -> random offset in [0, 60] minutes
}

export interface SchedulerState extends SchedulerConfig {
  chosenOffsetMinutes: number;
  chosenOffsetSeconds: number;
  windowStartIso: string | null;
  windowEndIso: string | null;
  nextRunAt: string | null;
  isRunningJob: boolean;
  lastRunAt: string | null;
  lastRunStatus: "idle" | "running" | "success" | "error";
  lastRunSummary: string | null;
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
 */
export function computeNextRandomizedRun(
  baseTime: string,
  jitterMinutes: number,
  now: Date = new Date(),
  forceTomorrow = false,
  randomFn: () => number = Math.random,
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

  const candidateWindowStart = new Date(now.getTime());
  candidateWindowStart.setHours(hours, minutes, 0, 0);

  let candidateNextRun = new Date(
    candidateWindowStart.getTime() + randomTotalSeconds * 1000,
  );

  // If forced to tomorrow or if the randomized time for today has already passed, schedule for tomorrow's window
  if (forceTomorrow || candidateNextRun.getTime() <= now.getTime() + 1000) {
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
  private readonly jobCallback: () => Promise<string | void>;

  constructor(jobCallback: () => Promise<string | void>) {
    this.jobCallback = jobCallback;
    this.reloadFromEnv();
  }

  /**
   * Reloads `CRON_ENABLED`, `CRON_BASE_TIME`, and `CRON_JITTER_MINUTES` from `.env` / `process.env`
   * and schedules the next randomized execution.
   */
  reloadFromEnv(): SchedulerState {
    loadEnv();
    const enabled =
      String(process.env.CRON_ENABLED ?? "true").toLowerCase() !== "false";
    const { normalized } = parseBaseTime(process.env.CRON_BASE_TIME ?? "19:00");
    const jitter = Math.max(
      0,
      Math.min(720, Number(process.env.CRON_JITTER_MINUTES ?? "60") || 0),
    );

    this.enabled = enabled;
    this.baseTime = normalized;
    this.jitterMinutes = jitter;
    this.reschedule(false);
    return this.getState();
  }

  /**
   * Updates the scheduler settings, persists them to `.env`, and recalculates the next randomized run.
   */
  updateConfig(
    partial: Partial<SchedulerConfig>,
    persistToEnv = true,
  ): SchedulerState {
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

    if (persistToEnv) {
      updateEnvValues({
        CRON_ENABLED: String(this.enabled),
        CRON_BASE_TIME: this.baseTime,
        CRON_JITTER_MINUTES: String(this.jitterMinutes),
      });
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

    const computed = computeNextRandomizedRun(
      this.baseTime,
      this.jitterMinutes,
      new Date(),
      forceTomorrow,
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
      const summary = await this.jobCallback();
      this.lastRunStatus = "success";
      this.lastRunSummary = summary || "Scheduled scrape completed.";
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
