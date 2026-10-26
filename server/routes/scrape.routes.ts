import { Router } from "express";
import type { ServerContext } from "../types.js";

export function createScrapeRouter(ctx: ServerContext): Router {
  const router = Router();

  router.post("/", (req, res) => {
    if (ctx.runner.getState().isScraping) {
      res.status(409).json({ error: "A scrape job is already running." });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const pageId = body.pageId ? String(body.pageId) : undefined;
    const withOffersOverride =
      body.withOffers !== undefined ? Boolean(body.withOffers) : undefined;

    void ctx.runner
      .runScrape({ pageId, withOffersOverride })
      .catch(() => undefined);

    res.status(202).json({
      started: true,
      runner: ctx.runner.getState(),
    });
  });

  return router;
}
