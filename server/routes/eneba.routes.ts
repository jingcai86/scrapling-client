import { Router } from "express";
import { getEnebaConfig, updateEnebaConfig } from "../../eneba/db.js";
import type { ServerContext } from "../types.js";

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
