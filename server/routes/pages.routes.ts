import { Router } from "express";
import type { ServerContext } from "../types.js";

export function createPagesRouter(ctx: ServerContext): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    res.json({ pages: ctx.pageStore.listPages() });
  });

  router.post("/", (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const page = ctx.pageStore.addPage({
      provider: String(body.provider ?? "eneba"),
      categoryName: String(body.categoryName ?? ""),
      url: String(body.url ?? ""),
      enabled: body.enabled !== undefined ? Boolean(body.enabled) : true,
      withOffers:
        body.withOffers !== undefined ? Boolean(body.withOffers) : true,
    });
    res.status(201).json({ page });
  });

  router.patch("/:id", (req, res) => {
    const id = req.params.id;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const updated = ctx.pageStore.updatePage(id, {
      categoryName:
        body.categoryName !== undefined
          ? String(body.categoryName)
          : undefined,
      url: body.url !== undefined ? String(body.url) : undefined,
      provider:
        body.provider !== undefined ? String(body.provider) : undefined,
      enabled:
        body.enabled !== undefined ? Boolean(body.enabled) : undefined,
      withOffers:
        body.withOffers !== undefined
          ? Boolean(body.withOffers)
          : undefined,
    });
    if (!updated) {
      res.status(404).json({ error: "Page not found" });
      return;
    }
    res.json({ page: updated });
  });

  router.delete("/:id", (req, res) => {
    const id = req.params.id;
    const deleted = ctx.pageStore.deletePage(id);
    res.status(deleted ? 200 : 404).json({ deleted });
  });

  return router;
}
