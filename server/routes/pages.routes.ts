import { Router } from "express";
import { upsertDbTarget, deleteDbTarget } from "../../core/index.js";
import type { ServerContext } from "../types.js";

export function createPagesRouter(ctx: ServerContext): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    res.json({ pages: ctx.pageStore.listPages() });
  });

  router.post("/", async (req, res, next) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const page = ctx.pageStore.addPage({
        category: String(body.category ?? body.provider ?? "eneba"),
        provider: String(body.provider ?? body.category ?? "eneba"),
        categoryName: String(body.categoryName ?? body.name ?? ""),
        name: String(body.name ?? body.categoryName ?? ""),
        url: String(body.url ?? ""),
        enabled: body.enabled !== undefined ? Boolean(body.enabled) : true,
        withOffers:
          body.withOffers !== undefined ? Boolean(body.withOffers) : true,
        scheduleId:
          body.scheduleId !== undefined ? String(body.scheduleId) : "default",
      });
      if (ctx.pool) {
        try {
          await upsertDbTarget(
            {
              id: page.id,
              provider: page.provider || page.category || "eneba",
              category: page.category || page.provider || "eneba",
              name: page.categoryName || page.name || page.id,
              url: page.url,
              enabled: page.enabled,
              withOffers: page.withOffers,
              scheduleId: page.scheduleId || "default",
              createdAt: page.createdAt,
            },
            ctx.pool,
          );
        } catch (dbErr) {
          console.warn("[PostgreSQL Warn] Failed to persist target to database:", dbErr);
        }
      }
      res.status(201).json({ page });
    } catch (err) {
      next(err);
    }
  });

  router.patch("/:id", async (req, res, next) => {
    try {
      const id = req.params.id;
      const body = (req.body ?? {}) as Record<string, unknown>;
      const updated = ctx.pageStore.updatePage(id, {
        category:
          body.category !== undefined
            ? String(body.category)
            : body.provider !== undefined
              ? String(body.provider)
              : undefined,
        provider:
          body.provider !== undefined
            ? String(body.provider)
            : body.category !== undefined
              ? String(body.category)
              : undefined,
        categoryName:
          body.categoryName !== undefined
            ? String(body.categoryName)
            : body.name !== undefined
              ? String(body.name)
              : undefined,
        name:
          body.name !== undefined
            ? String(body.name)
            : body.categoryName !== undefined
              ? String(body.categoryName)
              : undefined,
        url: body.url !== undefined ? String(body.url) : undefined,
        enabled:
          body.enabled !== undefined ? Boolean(body.enabled) : undefined,
        withOffers:
          body.withOffers !== undefined
            ? Boolean(body.withOffers)
            : undefined,
        scheduleId:
          body.scheduleId !== undefined ? String(body.scheduleId) : undefined,
      });
      if (!updated) {
        res.status(404).json({ error: "Page not found" });
        return;
      }
      if (ctx.pool) {
        try {
          await upsertDbTarget(
            {
              id: updated.id,
              provider: updated.provider || updated.category || "eneba",
              category: updated.category || updated.provider || "eneba",
              name: updated.categoryName || updated.name || updated.id,
              url: updated.url,
              enabled: updated.enabled,
              withOffers: updated.withOffers,
              scheduleId: updated.scheduleId || "default",
              createdAt: updated.createdAt,
            },
            ctx.pool,
          );
        } catch (dbErr) {
          console.warn("[PostgreSQL Warn] Failed to update target in database:", dbErr);
        }
      }
      res.json({ page: updated });
    } catch (err) {
      next(err);
    }
  });

  router.put("/:id/schedule", async (req, res, next) => {
    try {
      const id = req.params.id;
      const scheduleId = String(req.body?.scheduleId ?? "default");
      const updated = ctx.pageStore.assignPageSchedule(id, scheduleId);
      if (!updated) {
        res.status(404).json({ error: "Page not found" });
        return;
      }
      if (ctx.pool) {
        try {
          await upsertDbTarget(
            {
              id: updated.id,
              provider: updated.provider || updated.category || "eneba",
              category: updated.category || updated.provider || "eneba",
              name: updated.categoryName || updated.name || updated.id,
              url: updated.url,
              enabled: updated.enabled,
              withOffers: updated.withOffers,
              scheduleId: updated.scheduleId || "default",
              createdAt: updated.createdAt,
            },
            ctx.pool,
          );
        } catch (dbErr) {
          console.warn("[PostgreSQL Warn] Failed to update target schedule in database:", dbErr);
        }
      }
      res.json({ page: updated });
    } catch (err) {
      next(err);
    }
  });

  router.delete("/:id", async (req, res, next) => {
    try {
      const id = req.params.id;
      const deleted = ctx.pageStore.deletePage(id);
      if (deleted && ctx.pool) {
        try {
          await deleteDbTarget(id, ctx.pool);
        } catch (dbErr) {
          console.warn("[PostgreSQL Warn] Failed to delete target from database:", dbErr);
        }
      }
      res.status(deleted ? 200 : 404).json({ deleted });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
