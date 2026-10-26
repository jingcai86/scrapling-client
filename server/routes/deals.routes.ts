import { Router, type Request, type Response, type NextFunction } from "express";
import { searchDeals, type DealSearchQuery } from "../services/dealSearch.js";
import type { ServerContext } from "../types.js";

export function createDealsRouter(ctx: ServerContext): Router {
  const router = Router();

  const handleSearch = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const query = (req.query ?? {}) as Record<string, unknown>;

      const getStr = (key: string): string | undefined => {
        const fromBody = body[key];
        if (fromBody !== undefined && fromBody !== null) {
          return String(fromBody);
        }
        const fromQuery = query[key];
        return fromQuery !== undefined ? String(fromQuery) : undefined;
      };

      const bestRaw = getStr("bestOnly") ?? getStr("best");
      const bestOnly =
        bestRaw !== undefined
          ? ["true", "1", "yes"].includes(bestRaw.toLowerCase())
          : false;

      const minDiscountRaw = getStr("minDiscount");
      const maxPriceRaw = getStr("maxPrice");
      const limitRaw = getStr("limit");

      const searchParams: DealSearchQuery = {
        q: getStr("q"),
        name: getStr("name"),
        query: getStr("query"),
        category: getStr("category"),
        provider: getStr("provider"),
        date: getStr("date"),
        timestamp: getStr("timestamp"),
        from: getStr("from"),
        since: getStr("since"),
        to: getStr("to"),
        until: getStr("until"),
        bestOnly,
        minDiscount:
          minDiscountRaw !== undefined ? Number(minDiscountRaw) : undefined,
        maxPrice: maxPriceRaw !== undefined ? Number(maxPriceRaw) : undefined,
        limit: limitRaw !== undefined ? Number(limitRaw) : undefined,
      };

      const result = await searchDeals(
        searchParams,
        ctx.runner.getLatestStatuses(),
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  router.get("/", handleSearch);
  router.post("/", handleSearch);
  router.get("/search", handleSearch);
  router.post("/search", handleSearch);

  return router;
}
