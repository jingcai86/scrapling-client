import type pg from "pg";
import { createPgPool } from "../../core/index.js";
import { ensureEnebaSchema } from "../../eneba/db.js";
import type { SellerOffer } from "../../eneba/baseScraper.js";
import type { PageDealStatus } from "../../eneba/pageStats.js";

export interface DealSearchQuery {
  /** Product or category search query, e.g. "apple gift card", "nintendo 50", "psn" */
  q?: string;
  name?: string;
  query?: string;
  /** Optional category filter, e.g. "Apple Gift Cards" */
  category?: string;
  /** Optional provider filter, e.g. "eneba" */
  provider?: string;
  /**
   * Date or timestamp filter:
   * - Relative: "yesterday", "today", "24h", "7d"
   * - Date string: "2026-10-24"
   * - ISO timestamp or Unix epoch (seconds or ms): "2026-10-24T19:00:00Z" or "1761350400"
   */
  date?: string;
  timestamp?: string;
  /** Explicit range start (ISO string, YYYY-MM-DD, "yesterday", or Unix timestamp) */
  from?: string;
  since?: string;
  /** Explicit range end (ISO string, YYYY-MM-DD, or Unix timestamp) */
  to?: string;
  until?: string;
  /** If true, returns only the #1 best deal (or top deal per category) */
  bestOnly?: boolean;
  /** Minimum discount percentage (direct or effective) */
  minDiscount?: number;
  /** Maximum selling price */
  maxPrice?: number;
  /** Maximum number of deals to return (default: 20, max: 100) */
  limit?: number;
}

export interface SearchedDealItem {
  provider: string;
  category: string;
  rank: number;
  title: string;
  url: string;
  region: string;
  sellingPrice: number | null;
  originalPrice: number | null;
  faceValue: number | null;
  faceValueCurrency: string | null;
  discountPct: number;
  cashbackPct: number;
  effectiveDiscountPct: number;
  effectivePrice: number | null;
  savingsAmount: number;
  scrapedAt: string;
  competingOffers?: SellerOffer[];
}

export interface DealSearchResponse {
  query: {
    searchText: string | null;
    category: string | null;
    provider: string | null;
    fromIso: string | null;
    toIso: string | null;
    bestOnly: boolean;
    minDiscount: number | null;
    maxPrice: number | null;
    limit: number;
  };
  source: "database" | "cache";
  totalMatches: number;
  /** The #1 best matching deal by effectiveDiscountPct (convenient for Hermes single-answer lookups) */
  bestDeal: SearchedDealItem | null;
  deals: SearchedDealItem[];
}

/**
 * Parses a human/agent date or timestamp token into a `{ start: Date, end: Date }` window or single `Date`.
 */
export function resolveTimeRange(
  query: DealSearchQuery,
  now: Date = new Date(),
): { from: Date | null; to: Date | null } {
  const rawDateToken = (query.date ?? query.timestamp ?? "").trim();
  const rawFrom = (query.from ?? query.since ?? "").trim();
  const rawTo = (query.to ?? query.until ?? "").trim();

  const parseSinglePoint = (val: string): Date | null => {
    if (!val) return null;
    if (/^\d+$/.test(val)) {
      const num = Number(val);
      // Distinguish seconds vs milliseconds
      return new Date(num < 1e11 ? num * 1000 : num);
    }
    const parsed = new Date(val);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  if (rawFrom || rawTo) {
    let fromDate: Date | null = null;
    let toDate: Date | null = null;

    if (rawFrom.toLowerCase() === "yesterday") {
      fromDate = new Date(now.getTime());
      fromDate.setDate(fromDate.getDate() - 1);
      fromDate.setHours(0, 0, 0, 0);
    } else if (rawFrom.toLowerCase() === "today") {
      fromDate = new Date(now.getTime());
      fromDate.setHours(0, 0, 0, 0);
    } else {
      fromDate = parseSinglePoint(rawFrom);
    }

    if (rawTo.toLowerCase() === "yesterday") {
      toDate = new Date(now.getTime());
      toDate.setDate(toDate.getDate() - 1);
      toDate.setHours(23, 59, 59, 999);
    } else if (rawTo.toLowerCase() === "today") {
      toDate = new Date(now.getTime());
      toDate.setHours(23, 59, 59, 999);
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(rawTo)) {
      toDate = new Date(`${rawTo}T23:59:59.999`);
    } else {
      toDate = parseSinglePoint(rawTo);
    }

    return { from: fromDate, to: toDate };
  }

  if (!rawDateToken) {
    return { from: null, to: null };
  }

  const lower = rawDateToken.toLowerCase();

  if (lower === "yesterday") {
    const start = new Date(now.getTime());
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);

    const end = new Date(now.getTime());
    end.setDate(end.getDate() - 1);
    end.setHours(23, 59, 59, 999);
    return { from: start, to: end };
  }

  if (lower === "today") {
    const start = new Date(now.getTime());
    start.setHours(0, 0, 0, 0);
    const end = new Date(now.getTime());
    end.setHours(23, 59, 59, 999);
    return { from: start, to: end };
  }

  if (lower === "24h" || lower === "last_24h" || lower === "1d") {
    return {
      from: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      to: now,
    };
  }

  if (lower === "7d" || lower === "last_7d") {
    return {
      from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      to: now,
    };
  }

  // YYYY-MM-DD calendar date
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawDateToken)) {
    const start = new Date(`${rawDateToken}T00:00:00.000`);
    const end = new Date(`${rawDateToken}T23:59:59.999`);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      return { from: start, to: end };
    }
  }

  // Exact timestamp or Unix epoch -> match the full calendar day of that timestamp
  const point = parseSinglePoint(rawDateToken);
  if (point) {
    const start = new Date(point.getTime());
    start.setHours(0, 0, 0, 0);
    const end = new Date(point.getTime());
    end.setHours(23, 59, 59, 999);
    return { from: start, to: end };
  }

  return { from: null, to: null };
}

/**
 * Tokenized case-insensitive matcher so queries like "apple gift card" match
 * "Apple Gift Card 200 USD Key UNITED STATES" or category "Apple Gift Cards".
 */
export function matchesSearchTokens(
  haystack: string,
  searchText: string | null,
): boolean {
  if (!searchText) return true;
  const tokens = searchText
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (tokens.length === 0) return true;

  const normalizedHaystack = haystack.toLowerCase();
  return tokens.every((token) => normalizedHaystack.includes(token));
}

export interface DealSearchOptions {
  pool?: pg.Pool;
  useDb?: boolean;
}

/**
 * Searches historical and latest deals in PostgreSQL (`scrapling.records`) with fallback to cached statuses.
 */
export async function searchDeals(
  rawQuery: DealSearchQuery,
  cachedStatuses: PageDealStatus[] = [],
  options?: DealSearchOptions | boolean,
): Promise<DealSearchResponse> {
  const opts: DealSearchOptions =
    typeof options === "boolean" ? { useDb: options } : options || {};
  const useDb = opts.useDb ?? true;

  const searchText =
    (rawQuery.q ?? rawQuery.name ?? rawQuery.query ?? "").trim() || null;
  const categoryFilter = rawQuery.category?.trim() || null;
  const providerFilter = rawQuery.provider?.trim().toLowerCase() || null;
  const bestOnly = Boolean(rawQuery.bestOnly);
  const minDiscount =
    rawQuery.minDiscount !== undefined &&
    !Number.isNaN(Number(rawQuery.minDiscount))
      ? Number(rawQuery.minDiscount)
      : null;
  const maxPrice =
    rawQuery.maxPrice !== undefined && !Number.isNaN(Number(rawQuery.maxPrice))
      ? Number(rawQuery.maxPrice)
      : null;
  const limit = bestOnly
    ? 1
    : Math.min(100, Math.max(1, Number(rawQuery.limit ?? 20) || 20));

  const { from, to } = resolveTimeRange(rawQuery);

  // 1. Try querying PostgreSQL first if DATABASE_URL is configured or pool is provided
  if (useDb && (opts.pool || process.env.DATABASE_URL?.trim())) {
    const ownPool = !opts.pool;
    let pool: pg.Pool | null = null;
    try {
      pool = opts.pool ?? createPgPool();
      await ensureEnebaSchema(pool);

      const conditions: string[] = [];
      const values: unknown[] = [];

      if (from) {
        values.push(from.toISOString());
        conditions.push(`r.scraped_at >= $${values.length}`);
      }
      if (to) {
        values.push(to.toISOString());
        conditions.push(`r.scraped_at <= $${values.length}`);
      }
      if (providerFilter) {
        values.push(providerFilter);
        conditions.push(`r.provider = $${values.length}`);
      }
      if (categoryFilter) {
        values.push(`%${categoryFilter}%`);
        conditions.push(`(r.provider ILIKE $${values.length} OR t.name ILIKE $${values.length})`);
      }
      if (minDiscount !== null) {
        values.push(minDiscount);
        conditions.push(
          `GREATEST(r.discount_pct, r.effective_discount_pct) >= $${values.length}`,
        );
      }
      if (maxPrice !== null) {
        values.push(maxPrice);
        conditions.push(`r.selling_price <= $${values.length}`);
      }

      // If no time range is specified, only search the latest scrape run per target so we don't return duplicate historical rows
      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      const sql =
        !from && !to
          ? `
          WITH latest_runs AS (
            SELECT DISTINCT ON (r.scrape_target_id) r.scrape_run_id AS id
            FROM scrapling.records r
            WHERE r.scrape_target_id IS NOT NULL
            ORDER BY r.scrape_target_id, r.scraped_at DESC
          )
          SELECT
            r.scrape_run_id,
            r.product_id,
            r.scraped_at,
            r.rank,
            r.provider,
            r.scrape_target_id,
            COALESCE(t.name, r.provider) AS target_name,
            r.title,
            r.url,
            r.region,
            r.selling_price,
            r.original_price,
            r.face_value,
            r.face_value_currency,
            r.discount_pct,
            r.effective_discount_pct,
            r.effective_price,
            r.savings_amount,
            s.seller_name,
            s.seller_url,
            s.rating_pct,
            s.rating_label
          FROM scrapling.records r
          JOIN latest_runs lr ON lr.id = r.scrape_run_id
          LEFT JOIN scrapling.scrape_targets t ON t.id = r.scrape_target_id
          LEFT JOIN scrapling.sellers s ON s.id = r.seller_id
          ${whereClause}
          ORDER BY r.discount_pct DESC, r.savings_amount DESC, r.scraped_at DESC
        `
          : `
          SELECT
            r.scrape_run_id,
            r.product_id,
            r.scraped_at,
            r.rank,
            r.provider,
            r.scrape_target_id,
            COALESCE(t.name, r.provider) AS target_name,
            r.title,
            r.url,
            r.region,
            r.selling_price,
            r.original_price,
            r.face_value,
            r.face_value_currency,
            r.discount_pct,
            r.effective_discount_pct,
            r.effective_price,
            r.savings_amount,
            s.seller_name,
            s.seller_url,
            s.rating_pct,
            s.rating_label
          FROM scrapling.records r
          LEFT JOIN scrapling.scrape_targets t ON t.id = r.scrape_target_id
          LEFT JOIN scrapling.sellers s ON s.id = r.seller_id
          ${whereClause}
          ORDER BY r.discount_pct DESC, r.savings_amount DESC, r.scraped_at DESC
          LIMIT 500
        `;

      const res = await pool.query<{
        scrape_run_id: string;
        product_id: string;
        scraped_at: Date;
        rank: number;
        provider: string;
        scrape_target_id: string | null;
        target_name: string;
        title: string;
        url: string;
        region: string;
        selling_price: string | null;
        original_price: string | null;
        face_value: string | null;
        face_value_currency: string | null;
        discount_pct: string;
        effective_discount_pct: string;
        effective_price: string | null;
        savings_amount: string;
        seller_name: string | null;
        seller_url: string | null;
        rating_pct: string | null;
        rating_label: string | null;
      }>(sql, values);

      const matchedRows = res.rows.filter((row) => {
        if (providerFilter && providerFilter !== row.provider) return false;
        const haystack = `${row.title} ${row.provider} ${row.target_name || ""} ${row.region} ${row.seller_name || ""}`;
        return matchesSearchTokens(haystack, searchText);
      });

      if (
        matchedRows.length > 0 ||
        (res.rows.length > 0 && (from || to) && cachedStatuses.length === 0)
      ) {
        const sliced = matchedRows.slice(0, limit);
        const deals: SearchedDealItem[] = [];

        for (const row of sliced) {
          const competingOffers: SellerOffer[] = row.seller_name
            ? [
                {
                  sellerName: row.seller_name,
                  sellerSlug: row.seller_name,
                  sellerUrl: row.seller_url ?? "",
                  ratingScore:
                    row.rating_pct !== null ? Number(row.rating_pct) : null,
                  ratingLabel: row.rating_label,
                  price: Number(row.selling_price || 0),
                  cashbackPct: 0,
                  isLowestPrice: Number(row.rank) === 1,
                  isFeaturedOffer: false,
                },
              ]
            : [];

          deals.push({
            provider: row.provider,
            category: row.target_name || row.provider,
            rank: Number(row.rank ?? 1),
            title: row.title,
            url: row.url,
            region: row.region,
            sellingPrice:
              row.selling_price !== null ? Number(row.selling_price) : null,
            originalPrice:
              row.original_price !== null ? Number(row.original_price) : null,
            faceValue: row.face_value !== null ? Number(row.face_value) : null,
            faceValueCurrency: row.face_value_currency,
            discountPct: Number(row.discount_pct),
            cashbackPct: 0,
            effectiveDiscountPct: Number(row.effective_discount_pct),
            effectivePrice:
              row.effective_price !== null ? Number(row.effective_price) : null,
            savingsAmount: Number(row.savings_amount),
            scrapedAt: new Date(row.scraped_at).toISOString(),
            competingOffers:
              competingOffers.length > 0 ? competingOffers : undefined,
          });
        }

        return {
          query: {
            searchText,
            category: categoryFilter,
            provider: providerFilter,
            fromIso: from ? from.toISOString() : null,
            toIso: to ? to.toISOString() : null,
            bestOnly,
            minDiscount,
            maxPrice,
            limit,
          },
          source: "database",
          totalMatches: matchedRows.length,
          bestDeal: deals[0] ?? null,
          deals,
        };
      }
    } catch {
      // Fall back to in-memory / disk cache if DB query fails
    } finally {
      if (ownPool && pool) {
        await pool.end().catch(() => {});
      }
    }
  }

  // 2. Fallback to in-memory / disk-cached PageDealStatus[]
  const allCachedDeals: SearchedDealItem[] = [];
  for (const st of cachedStatuses) {
    const scrapedTime = new Date(st.scrapedAt).getTime();
    if (from && scrapedTime < from.getTime()) continue;
    if (to && scrapedTime > to.getTime()) continue;
    if (
      categoryFilter &&
      !st.category.toLowerCase().includes(categoryFilter.toLowerCase()) &&
      !(st.categoryName || "").toLowerCase().includes(categoryFilter.toLowerCase())
    ) {
      continue;
    }
    const itemProvider = (st.provider || st.category || "eneba").toLowerCase();
    if (providerFilter && !itemProvider.includes(providerFilter)) {
      continue;
    }

    for (let i = 0; i < st.rankedDeals.length; i++) {
      const deal = st.rankedDeals[i];
      const haystack = `${deal.title} ${st.category} ${st.categoryName || ""} ${deal.region} ${itemProvider}`;
      if (!matchesSearchTokens(haystack, searchText)) continue;
      if (
        minDiscount !== null &&
        Math.max(deal.discountPct, deal.effectiveDiscountPct) < minDiscount
      ) {
        continue;
      }
      if (
        maxPrice !== null &&
        (deal.sellingPrice === null || deal.sellingPrice > maxPrice)
      ) {
        continue;
      }

      const isBestOnPage =
        st.bestEffectiveDeal?.url === deal.url || st.bestDeal?.url === deal.url;

      allCachedDeals.push({
        provider: itemProvider,
        category: st.categoryName || st.category,
        rank: i + 1,
        title: deal.title,
        url: deal.url,
        region: deal.region,
        sellingPrice: deal.sellingPrice,
        originalPrice: deal.originalPrice,
        faceValue: deal.faceValue,
        faceValueCurrency: deal.faceValueCurrency,
        discountPct: deal.discountPct,
        cashbackPct: deal.cashbackPct,
        effectiveDiscountPct: deal.effectiveDiscountPct,
        effectivePrice: deal.effectivePrice,
        savingsAmount: deal.savingsAmount,
        scrapedAt: st.scrapedAt,
        competingOffers:
          isBestOnPage && st.bestDealOffers?.length
            ? st.bestDealOffers
            : undefined,
      });
    }
  }

  allCachedDeals.sort(
    (a, b) =>
      b.discountPct - a.discountPct ||
      (b.savingsAmount || 0) - (a.savingsAmount || 0),
  );

  const sliced = allCachedDeals.slice(0, limit);

  return {
    query: {
      searchText,
      category: categoryFilter,
      provider: providerFilter,
      fromIso: from ? from.toISOString() : null,
      toIso: to ? to.toISOString() : null,
      bestOnly,
      minDiscount,
      maxPrice,
      limit,
    },
    source: "cache",
    totalMatches: allCachedDeals.length,
    bestDeal: sliced[0] ?? null,
    deals: sliced,
  };
}
