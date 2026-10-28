import { Router } from "express";
import { upsertDbTarget, deleteDbTarget } from "../../core/index.js";
import type { ServerContext } from "../types.js";

export function createPagesRouter(ctx: ServerContext): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    res.json({ pages: ctx.pageStore.listPages() });
  });

  router.get("/products", async (_req, res, next) => {
    try {
      if (ctx.pool) {
        const prodRes = await ctx.pool.query<{
          id: string;
          slug: string;
          title: string;
          url: string | null;
          provider: string | null;
        }>(
          "SELECT id, slug, title, url, provider FROM scrapling.products ORDER BY title ASC",
        );
        res.json({ products: prodRes.rows });
        return;
      }
      res.json({ products: [] });
    } catch (err) {
      next(err);
    }
  });

  router.post("/", async (req, res, next) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      let productId = body.productId ? String(body.productId) : undefined;
      let url = String(body.url ?? "");
      let categoryName = String(body.categoryName ?? body.name ?? "");
      let productSlug: string | undefined = body.productSlug ? String(body.productSlug) : undefined;
      let productTitle: string | undefined = body.productTitle ? String(body.productTitle) : undefined;

      if (ctx.pool && productId) {
        try {
          const prodRes = await ctx.pool.query<{ id: string; slug: string; title: string; url: string | null; provider: string | null }>(
            "SELECT id, slug, title, url, provider FROM scrapling.products WHERE id = $1 LIMIT 1",
            [productId],
          );
          if (prodRes.rows.length > 0) {
            const p = prodRes.rows[0];
            productSlug = p.slug;
            productTitle = p.title;
            if (!url && p.url) url = p.url;
            if (!categoryName) categoryName = p.title;
          }
        } catch {
          // fallback
        }
      }

      const page = ctx.pageStore.addPage({
        productId,
        productSlug,
        productTitle,
        category: String(body.category ?? body.provider ?? "eneba"),
        provider: String(body.provider ?? body.category ?? "eneba"),
        categoryName,
        name: categoryName,
        url,
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
              productId: page.productId,
              productSlug: page.productSlug,
              productTitle: page.productTitle,
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
      let productId = body.productId !== undefined ? (body.productId ? String(body.productId) : null) : undefined;
      let url = body.url !== undefined ? String(body.url) : undefined;
      let productSlug = body.productSlug !== undefined ? String(body.productSlug) : undefined;
      let productTitle = body.productTitle !== undefined ? String(body.productTitle) : undefined;

      if (ctx.pool && productId) {
        try {
          const prodRes = await ctx.pool.query<{ id: string; slug: string; title: string; url: string | null }>(
            "SELECT id, slug, title, url FROM scrapling.products WHERE id = $1 LIMIT 1",
            [productId],
          );
          if (prodRes.rows.length > 0) {
            const p = prodRes.rows[0];
            productSlug = p.slug;
            productTitle = p.title;
            if (!url && p.url) url = p.url;
          }
        } catch {
          // fallback
        }
      }

      const updated = ctx.pageStore.updatePage(id, {
        productId,
        productSlug,
        productTitle,
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
        url,
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
              productId: updated.productId,
              productSlug: updated.productSlug,
              productTitle: updated.productTitle,
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
              productId: updated.productId,
              productSlug: updated.productSlug,
              productTitle: updated.productTitle,
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
