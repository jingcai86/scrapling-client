import { Router } from "express";
import {
  ENV_SCHEMA,
  getDbScrapeHistory,
  readAllConfigValues,
  resolveEnvFilePath,
} from "../../core/index.js";
import { getEnebaConfig } from "../../eneba/db.js";
import type { ServerContext } from "../types.js";

export function createDashboardRouter(ctx: ServerContext): Router {
  const router = Router();

  router.get("/", async (_req, res, next) => {
    try {
      const pages = ctx.pageStore.listPages();
      const providers = Array.from(new Set(pages.map((p) => p.provider)));
      const configValues = await readAllConfigValues({
        pool: ctx.pool,
        envPath: ctx.envPath,
      });
      const enebaConfig = await getEnebaConfig({ pool: ctx.pool });

      let history = ctx.runner.getHistory();
      if (ctx.pool) {
        try {
          const dbHistory = await getDbScrapeHistory(ctx.pool);
          if (dbHistory.length > 0) {
            history = dbHistory;
          }
        } catch {
          // fallback to runner in-memory history
        }
      }

      const assignedPagesMap = ctx.pageStore.getAssignedPagesMap();
      res.json({
        pages,
        providers,
        statuses: ctx.runner.getLatestStatuses(),
        runner: ctx.runner.getState(),
        scheduler: ctx.scheduler.getState(),
        schedulers: ctx.schedulerManager.getStates(assignedPagesMap),
        enebaConfig,
        history,
        env: {
          schema: ENV_SCHEMA,
          values: configValues,
          envFilePath: resolveEnvFilePath(ctx.envPath),
        },
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
