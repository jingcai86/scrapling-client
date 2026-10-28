import { Router } from "express";
import {
  deleteDbConfigKey,
  updateDbConfigValues,
} from "../../core/index.js";
import { getEnebaConfig, updateEnebaConfig } from "../../eneba/db.js";
import type { ServerContext } from "../types.js";

export function createConfigRouter(ctx: ServerContext): Router {
  const router = Router();

  router.put("/", async (req, res, next) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const rawUpdates = (body.updates ?? {}) as Record<string, unknown>;
      const cleanUpdates: Record<string, string> = {};
      for (const [k, v] of Object.entries(rawUpdates)) {
        cleanUpdates[k] = String(v ?? "");
      }
      const values = await updateDbConfigValues(cleanUpdates, {
        pool: ctx.pool,
        envPath: ctx.envPath,
      });
      res.json({
        values,
        scheduler: ctx.scheduler.getState(),
      });
    } catch (err) {
      next(err);
    }
  });

  router.delete("/:key", async (req, res, next) => {
    try {
      const key = decodeURIComponent(req.params.key);
      const values = await deleteDbConfigKey(key, {
        pool: ctx.pool,
        envPath: ctx.envPath,
      });
      res.json({ values });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

/**
 * Backward-compatible router for /api/eneba/config.
 */
export function createEnebaRouter(ctx: ServerContext): Router {
  const router = Router();

  router.get("/", async (_req, res, next) => {
    try {
      const config = await getEnebaConfig({ pool: ctx.pool });
      res.json({ config });
    } catch (err) {
      next(err);
    }
  });

  router.all("/", async (req, res, next) => {
    if (req.method !== "PUT" && req.method !== "POST") {
      return next();
    }
    try {
      const rawUpdates = (req.body?.updates ?? req.body ?? {}) as Record<
        string,
        string | number
      >;
      const cleanUpdates: Record<string, string> = {};
      for (const [k, v] of Object.entries(rawUpdates)) {
        if (k === "updates") continue;
        cleanUpdates[k] = String(v ?? "");
      }
      const config = await updateEnebaConfig(cleanUpdates, {
        pool: ctx.pool,
      });
      res.json({ config });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
