import { Router } from "express";
import {
  upsertDbScheduler,
  deleteDbScheduler,
  isDefaultSchedulerId,
} from "../../core/index.js";
import type { ServerContext } from "../types.js";

export function createSchedulerRouter(ctx: ServerContext): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    const assignedPagesMap = ctx.pageStore.getAssignedPagesMap();
    res.json({
      scheduler: ctx.scheduler.getState(),
      schedulers: ctx.schedulerManager.getStates(assignedPagesMap),
    });
  });

  router.post("/", async (req, res, next) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const created = ctx.pageStore.addSchedule({
        name: String(body.name || "Custom Schedule"),
        baseTime: String(body.baseTime || "19:00"),
        jitterMinutes: Number(body.jitterMinutes ?? 60),
        enabled: body.enabled !== undefined ? Boolean(body.enabled) : true,
      });
      const state = ctx.schedulerManager.addOrUpdateSchedule(created);
      if (ctx.pool) {
        try {
          await upsertDbScheduler(created, ctx.pool);
        } catch (dbErr) {
          console.warn("[PostgreSQL Warn] Failed to persist new schedule to database:", dbErr);
        }
      }
      res.status(201).json({ scheduler: state });
    } catch (err) {
      next(err);
    }
  });

  router.put("/:id/reroll", (req, res) => {
    const id = req.params.id;
    const rerolled = ctx.schedulerManager.reroll(id);
    if (!rerolled) {
      res.status(404).json({ error: `Schedule "${id}" not found.` });
      return;
    }
    res.json({ scheduler: rerolled });
  });

  router.post("/:id/run", async (req, res, next) => {
    try {
      const id = req.params.id;
      const results = await ctx.runner.runScrape({ scheduleId: id });
      res.json({ scrapedCount: results.length, statuses: results });
    } catch (err) {
      next(err);
    }
  });

  router.delete("/:id", async (req, res) => {
    const id = req.params.id;
    if (isDefaultSchedulerId(id)) {
      res.status(400).json({ error: "The default schedule cannot be deleted." });
      return;
    }
    const deleted = ctx.pageStore.deleteSchedule(id);
    if (deleted) {
      ctx.schedulerManager.removeSchedule(id);
      if (ctx.pool) {
        try {
          await deleteDbScheduler(id, ctx.pool);
        } catch (dbErr) {
          console.warn("[PostgreSQL Warn] Failed to delete schedule from database:", dbErr);
        }
      }
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Schedule not found." });
    }
  });

  router.put("/:id", async (req, res, next) => {
    try {
      const id = req.params.id;
      const body = (req.body ?? {}) as Record<string, unknown>;

      if (body.reroll) {
        const rerolled = ctx.schedulerManager.reroll(id);
        res.json({ scheduler: rerolled });
        return;
      }

      const updated = ctx.pageStore.updateSchedule(id, {
        name: body.name !== undefined ? String(body.name) : undefined,
        baseTime: body.baseTime !== undefined ? String(body.baseTime) : undefined,
        jitterMinutes:
          body.jitterMinutes !== undefined
            ? Number(body.jitterMinutes)
            : undefined,
        enabled: body.enabled !== undefined ? Boolean(body.enabled) : undefined,
      });

      if (!updated) {
        res.status(404).json({ error: "Schedule not found." });
        return;
      }

      const state = ctx.schedulerManager.addOrUpdateSchedule(updated);
      if (ctx.pool) {
        try {
          await upsertDbScheduler(updated, ctx.pool);
        } catch (dbErr) {
          console.warn("[PostgreSQL Warn] Failed to update schedule in database:", dbErr);
        }
      }
      res.json({ scheduler: state });
    } catch (err) {
      next(err);
    }
  });

  // Legacy fallback for PUT /api/scheduler (targets 'default' schedule)
  router.put("/", async (req, res, next) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      if (body.reroll) {
        res.json({ scheduler: ctx.scheduler.rerollNextRun() });
        return;
      }
      const updated = ctx.pageStore.updateSchedule("default", {
        baseTime: body.baseTime !== undefined ? String(body.baseTime) : undefined,
        jitterMinutes:
          body.jitterMinutes !== undefined
            ? Number(body.jitterMinutes)
            : undefined,
        enabled: body.enabled !== undefined ? Boolean(body.enabled) : undefined,
      });
      const state = updated
        ? ctx.schedulerManager.addOrUpdateSchedule(updated)
        : ctx.scheduler.updateConfig(
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

      if (updated && ctx.pool) {
        try {
          await upsertDbScheduler(updated, ctx.pool);
        } catch (dbErr) {
          console.warn("[PostgreSQL Warn] Failed to update default schedule in database:", dbErr);
        }
      }

      res.json({ scheduler: state });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

