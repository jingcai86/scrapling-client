import { Router } from "express";
import { updateDbConfigValues } from "../../core/index.js";
import type { ServerContext } from "../types.js";

export function createSchedulerRouter(ctx: ServerContext): Router {
  const router = Router();

  router.put("/", async (req, res, next) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      if (body.reroll) {
        res.json({ scheduler: ctx.scheduler.rerollNextRun() });
        return;
      }
      const state = ctx.scheduler.updateConfig(
        {
          enabled:
            body.enabled !== undefined ? Boolean(body.enabled) : undefined,
          baseTime:
            body.baseTime !== undefined ? String(body.baseTime) : undefined,
          jitterMinutes:
            body.jitterMinutes !== undefined
              ? Number(body.jitterMinutes)
              : undefined,
        },
        false,
      );
      await updateDbConfigValues(
        {
          CRON_ENABLED: String(state.enabled),
          CRON_BASE_TIME: state.baseTime,
          CRON_JITTER_MINUTES: String(state.jitterMinutes),
        },
        { pool: ctx.pool, envPath: ctx.envPath },
      );
      res.json({ scheduler: state });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
