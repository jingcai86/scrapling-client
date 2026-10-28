import type { GiftCardListing, SellerOffer } from "./baseScraper.js";
import type { DbPersistenceStatus } from "./db.js";

export interface RankedGiftCardListing extends GiftCardListing {
  rank: number;
}

export interface TargetScrapeRunLog {
  batchId: string;
  runTime: string;
  itemsCount: number;
  inStockCount: number;
  status: "success" | "warning" | "error";
  durationMs?: number;
}

export interface PageDealStatus {
  scrapedAt: string;
  category: string; // site name: "eneba", "g2a"
  provider?: string; // alias for provider site name
  scrapeTargetId?: string;
  targetId?: string;
  targetName?: string;
  name?: string; // alias for targetName
  pageUrl: string;
  pageNumber: number;
  totalListings: number;
  inStockCount: number;
  outOfStockCount: number;
  discountedCount: number;
  /** Total number of historical scrape runs executed for this target */
  scrapeCount?: number;
  /** Status of the latest scrape run */
  runStatus?: "success" | "warning" | "error" | "idle";
  /** Recent historical scrape runs for this target */
  recentRuns?: TargetScrapeRunLog[];
  /** Average discount (%) across items that have a positive discount */
  averageDiscountPctOnDiscounted: number;
  /** Average discount (%) across all in-stock items on the page */
  averageDiscountPctAllInStock: number;
  /** Average effective discount (%) including cashback across all in-stock items */
  averageEffectiveDiscountPct: number;
  maxDiscountPct: number;
  maxEffectiveDiscountPct: number;
  bestDeal: GiftCardListing | null;
  bestEffectiveDeal: GiftCardListing | null;
  /** Competing third-party seller offers for the page's #1 best deal */
  bestDealOffers: SellerOffer[];
  /** Top N (default 10) deals ranked 1..10 */
  topDeals: RankedGiftCardListing[];
  rankedDeals: GiftCardListing[];
  /** Optional database persistence status (never blocks returning the scrape result) */
  dbStatus?: DbPersistenceStatus;
}

export interface AnalyzePageOptions {
  category?: string;
  provider?: string;
  scrapeTargetId?: string;
  targetId?: string;
  targetName?: string;
  name?: string;
  pageUrl?: string;
  pageNumber?: number;
  scrapedAt?: Date | string;
  topN?: number;
  bestDealOffers?: SellerOffer[];
}

export interface FormatReportOptions {
  topN?: number;
}

function mean(values: number[]): number {
  if (!values.length) {
    return 0;
  }
  const sum = values.reduce((acc, val) => acc + val, 0);
  return Number((sum / values.length).toFixed(2));
}

/**
 * Computes page-level status metrics and identifies the top 10 deals from scraped listings.
 */
export function analyzePageDeals(
  listings: GiftCardListing[],
  {
    category = "eneba",
    scrapeTargetId,
    targetId,
    targetName,
    name,
    pageUrl = "",
    pageNumber = 1,
    scrapedAt = new Date(),
    topN = 10,
    bestDealOffers = [],
  }: AnalyzePageOptions = {},
): PageDealStatus {
  const scrapedAtIso =
    scrapedAt instanceof Date
      ? scrapedAt.toISOString()
      : new Date(scrapedAt).toISOString();

  const totalListings = listings.length;
  const inStockListings = listings.filter(
    (item) => item.inStock && item.sellingPrice !== null,
  );
  const outOfStockCount = totalListings - inStockListings.length;

  const discountedListings = inStockListings.filter(
    (item) => item.discountPct > 0,
  );

  const averageDiscountPctOnDiscounted = mean(
    discountedListings.map((item) => item.discountPct),
  );
  const averageDiscountPctAllInStock = mean(
    inStockListings.map((item) => item.discountPct),
  );
  const averageEffectiveDiscountPct = averageDiscountPctAllInStock;

  // Sort in-stock listings by discountPct desc, then savingsAmount desc, then sellingPrice asc
  const rawRankedDeals = [...inStockListings].sort((a, b) => {
    if (b.discountPct !== a.discountPct) {
      return b.discountPct - a.discountPct;
    }
    if ((b.savingsAmount || 0) !== (a.savingsAmount || 0)) {
      return (b.savingsAmount || 0) - (a.savingsAmount || 0);
    }
    return (a.sellingPrice || 0) - (b.sellingPrice || 0);
  });

  const rankedDeals = deduplicateRankedDeals(rawRankedDeals);

  const bestDeal = rankedDeals[0] ?? null;
  const bestEffectiveDeal = rankedDeals[0] ?? null;

  if (bestDeal && bestDealOffers.length > 0) {
    bestDeal.offers = bestDealOffers;
  }

  const maxDiscountPct = bestDeal ? bestDeal.discountPct : 0;
  const maxEffectiveDiscountPct = maxDiscountPct;

  const topDeals: RankedGiftCardListing[] = rankedDeals
    .slice(0, topN)
    .map((deal, idx) => ({
      rank: idx + 1,
      ...deal,
    }));

  const resolvedTargetName = targetName || name || "";

  return {
    scrapedAt: scrapedAtIso,
    category,
    scrapeTargetId: scrapeTargetId || targetId,
    targetId: scrapeTargetId || targetId,
    targetName: resolvedTargetName,
    name: resolvedTargetName,
    pageUrl,
    pageNumber,
    totalListings,
    inStockCount: inStockListings.length,
    outOfStockCount,
    discountedCount: discountedListings.length,
    averageDiscountPctOnDiscounted,
    averageDiscountPctAllInStock,
    averageEffectiveDiscountPct,
    maxDiscountPct,
    maxEffectiveDiscountPct,
    bestDeal,
    bestEffectiveDeal,
    bestDealOffers,
    topDeals,
    rankedDeals,
  };
}

function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "N/A";
  }
  return `$${value.toFixed(2)}`;
}

/**
 * Formats a human-readable CLI status summary & top deals table for a scraped Eneba page.
 */
export function formatPageStatusReport(
  status: PageDealStatus,
  { topN = 10 }: FormatReportOptions = {},
): string {
  const divider = "=".repeat(78);
  const subDivider = "-".repeat(78);
  const lines: string[] = [
    divider,
    `Category   : ${status.category}`,
    ...(status.pageUrl ? [`Page URL   : ${status.pageUrl}`] : []),
    `Scraped At : ${status.scrapedAt}`,
    subDivider,
    `Page Status Summary:`,
    `  • Total Cards Seen              : ${status.totalListings} (${status.inStockCount} in stock, ${status.outOfStockCount} sold out)`,
    `  • Cards With Direct Discount    : ${status.discountedCount} / ${status.inStockCount}`,
    `  • Avg Discount (Discounted)     : ${status.averageDiscountPctOnDiscounted.toFixed(2)}%`,
    `  • Avg Discount (All In-Stock)   : ${status.averageDiscountPctAllInStock.toFixed(2)}%`,
    `  • Max Discount Seen             : ${status.maxDiscountPct.toFixed(2)}%`,
  ];

  if (status.bestDeal) {
    const deal = status.bestDeal;
    const baseline =
      deal.originalPrice ??
      (deal.faceValueCurrency === "USD" ? deal.faceValue : null);
    lines.push(
      subDivider,
      `Best Deal on Page:`,
      `  • Title            : ${deal.title}`,
      `  • Region           : ${deal.region}`,
      `  • Selling Price    : ${formatPrice(deal.sellingPrice)}${baseline ? ` (Baseline: ${formatPrice(baseline)}, Save ${formatPrice(deal.savingsAmount)})` : ""}`,
      `  • Discount         : ${deal.discountPct.toFixed(2)}%`,
      `  • Link             : ${deal.url}`,
    );
  } else {
    lines.push(subDivider, `Best Deal on Page: No in-stock listings found.`);
  }

  if (status.bestDealOffers && status.bestDealOffers.length > 0) {
    const targetTitle =
      status.bestEffectiveDeal?.title ?? status.bestDeal?.title ?? "Best Deal";
    lines.push(
      subDivider,
      `Competing Seller Offers for #1 Deal (${targetTitle}):`,
    );
    status.bestDealOffers.forEach((offer, idx) => {
      const tags: string[] = [];
      if (offer.isLowestPrice) tags.push("LOWEST PRICE");
      if (offer.isFeaturedOffer) tags.push("FEATURED");
      const tagStr = tags.length > 0 ? ` [${tags.join(", ")}]` : "";
      const ratingStr =
        offer.ratingScore !== null
          ? `${offer.ratingScore.toFixed(2)} (${offer.ratingLabel ?? "Rated"})`
          : "Unrated";
      lines.push(
        `  ${idx + 1}. ${formatPrice(offer.price)} — ${offer.sellerName} [Rating: ${ratingStr}]${tagStr}`,
      );
    });
  }

  const dealsToShow = status.rankedDeals.slice(0, topN);
  if (dealsToShow.length > 0) {
    lines.push(
      subDivider,
      `Top ${dealsToShow.length} Deals (Ranked 1-${dealsToShow.length} by Discount %):`,
    );
    dealsToShow.forEach((deal, idx) => {
      const rankStr = String(idx + 1).padStart(2);
      const priceStr = formatPrice(deal.sellingPrice).padStart(7);
      const discStr = `${deal.discountPct.toFixed(2)}%`.padStart(7);
      lines.push(
        `  ${rankStr}. [Disc: ${discStr}] ${priceStr} — ${deal.title} (${deal.region})\n      Link: ${deal.url}`,
      );
    });
  }

  lines.push(divider);
  return lines.join("\n");
}

/**
 * Resolves the canonical provider ('eneba' | 'g2a') from a status or config object.
 */
export function getCanonicalProvider(s: {
  provider?: string;
  category?: string;
  pageUrl?: string;
  url?: string;
  name?: string;
  targetName?: string;
  categoryName?: string;
}): string {
  const url = (s.pageUrl || s.url || "").toLowerCase();
  const name = (s.targetName || s.name || s.categoryName || "").toLowerCase();
  const rawProv = (s.provider || s.category || "").toLowerCase().trim();

  if (url.includes("g2a.com") || name.includes("(g2a)") || name.includes(" g2a") || rawProv === "g2a") {
    return "g2a";
  }
  if (url.includes("eneba.com") || name.includes("(eneba)") || name.includes(" eneba") || rawProv === "eneba") {
    return "eneba";
  }
  return rawProv || "eneba";
}

/**
 * Generates a normalized, canonical target key (e.g. 'eneba:psn', 'g2a:google-play')
 * to robustly detect duplicate category status records even when URLs, IDs, or display
 * strings vary slightly across scrape batches.
 */
export function getCanonicalTargetKey(s: Partial<PageDealStatus> | any): string {
  if (!s) return "";
  const prov = getCanonicalProvider(s);
  const raw = `${s.scrapeTargetId || ""} ${s.targetId || ""} ${s.targetName || ""} ${s.name || ""} ${s.categoryName || ""} ${s.pageUrl || ""} ${s.url || ""}`.toLowerCase();

  if (raw.includes("playstation") || raw.includes("psn")) return `${prov}:psn`;
  if (raw.includes("nintendo") || raw.includes("eshop")) return `${prov}:nintendo`;
  if (raw.includes("google") || raw.includes("android") || raw.includes("play store")) return `${prov}:google-play`;
  if (raw.includes("amazon")) return `${prov}:amazon`;
  if (raw.includes("apple") || raw.includes("itunes") || raw.includes("app store")) return `${prov}:apple`;
  if (raw.includes("steam")) return `${prov}:steam`;

  const fallback = (
    s.targetName ||
    s.name ||
    s.categoryName ||
    s.scrapeTargetId ||
    s.targetId ||
    s.pageUrl ||
    s.category ||
    ""
  )
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  return `${prov}:${fallback}`;
}

/**
 * Normalizes and deduplicates gift card listings so that each distinct product card
 * appears at most once, keeping the listing with the best discount % (or lowest selling price).
 */
export function deduplicateRankedDeals<
  T extends {
    title?: string;
    url?: string;
    discountPct?: number;
    sellingPrice?: number | null;
  },
>(deals: T[]): T[] {
  const result: T[] = [];

  for (const deal of deals) {
    if (!deal || !deal.title) continue;
    const dTitle = (deal.title || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const rawUrl = (deal.url || "").trim().toLowerCase();
    const dUrl = rawUrl
      .split("?")[0]
      .replace(/^https?:\/\/[^/]+/, "")
      .replace(/^\/(?:us|en|de|fr|es|it)\//, "/");

    const isProductUrl = (u: string) =>
      u.length > 5 &&
      !u.startsWith("/store") &&
      !u.startsWith("/category") &&
      !u.startsWith("/search");

    const existingIdx = result.findIndex((ex) => {
      const exTitle = (ex.title || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      if (dTitle && exTitle && dTitle === exTitle) return true;

      const exRawUrl = (ex.url || "").trim().toLowerCase();
      const exUrl = exRawUrl
        .split("?")[0]
        .replace(/^https?:\/\/[^/]+/, "")
        .replace(/^\/(?:us|en|de|fr|es|it)\//, "/");

      if (isProductUrl(dUrl) && isProductUrl(exUrl) && dUrl === exUrl) {
        return true;
      }
      return false;
    });

    if (existingIdx === -1) {
      result.push(deal);
    } else {
      const ex = result[existingIdx];
      const exDisc = ex.discountPct ?? 0;
      const dDisc = deal.discountPct ?? 0;
      if (dDisc > exDisc) {
        result[existingIdx] = deal;
      }
    }
  }

  return result;
}

/**
 * Normalizes and deduplicates an array of PageDealStatus objects so that each distinct
 * scrape target appears at most once (keeping the latest scrape result when duplicate
 * snapshots or keys exist).
 */
export function deduplicatePageDealStatuses(
  statuses: PageDealStatus[],
): PageDealStatus[] {
  const result: PageDealStatus[] = [];

  for (const st of statuses) {
    if (!st) continue;
    const stKey = getCanonicalTargetKey(st);
    const stProvider = getCanonicalProvider(st);
    const stId = (st.scrapeTargetId || st.targetId || "").trim();
    const stName = (st.targetName || st.name || "").trim().toLowerCase();
    const stUrl = (st.pageUrl || "").trim().toLowerCase();

    const existingIdx = result.findIndex((existing) => {
      const exKey = getCanonicalTargetKey(existing);
      if (stKey && exKey && stKey === exKey) {
        return true;
      }
      const exProvider = getCanonicalProvider(existing);
      if (stProvider !== exProvider) {
        return false;
      }
      const exId = (existing.scrapeTargetId || existing.targetId || "").trim();
      if (stId && exId && stId === exId) {
        return true;
      }
      const exName = (existing.targetName || existing.name || "").trim().toLowerCase();
      if (stName && exName && stName === exName) {
        return true;
      }
      const exUrl = (existing.pageUrl || "").trim().toLowerCase();
      if (stUrl && exUrl && (stUrl === exUrl || stUrl.split("?")[0] === exUrl.split("?")[0])) {
        return true;
      }
      return false;
    });

    if (existingIdx === -1) {
      result.push({
        ...st,
        provider: stProvider,
        category: stProvider,
      });
    } else {
      const exTime = new Date(result[existingIdx].scrapedAt || 0).getTime();
      const stTime = new Date(st.scrapedAt || 0).getTime();
      const preferStName =
        Boolean(st.targetName || st.name) &&
        !(st.targetName || st.name)!.toLowerCase().startsWith("http");
      const preferExName =
        Boolean(result[existingIdx].targetName || result[existingIdx].name) &&
        !(result[existingIdx].targetName || result[existingIdx].name)!.toLowerCase().startsWith("http");
      const bestName = preferStName
        ? (st.targetName || st.name)
        : preferExName
          ? (result[existingIdx].targetName || result[existingIdx].name)
          : (st.targetName || result[existingIdx].targetName);

      const mergedDeals = deduplicateRankedDeals(
        stTime >= exTime
          ? [...(st.rankedDeals || st.topDeals || []), ...(result[existingIdx].rankedDeals || result[existingIdx].topDeals || [])]
          : [...(result[existingIdx].rankedDeals || result[existingIdx].topDeals || []), ...(st.rankedDeals || st.topDeals || [])],
      );
      const bestRanked = mergedDeals[0] ?? (stTime >= exTime ? st.bestDeal : result[existingIdx].bestDeal);
      const bestEff = mergedDeals[0] ?? (stTime >= exTime ? st.bestEffectiveDeal : result[existingIdx].bestEffectiveDeal);

      const existingHasData =
        (result[existingIdx].totalListings > 0) ||
        Boolean(result[existingIdx].bestDeal) ||
        Boolean(result[existingIdx].rankedDeals && result[existingIdx].rankedDeals.length > 0);
      const stHasData =
        (st.totalListings > 0) ||
        Boolean(st.bestDeal) ||
        Boolean(st.rankedDeals && st.rankedDeals.length > 0);

      const preserveExistingMetrics = !stHasData && existingHasData;

      if (stTime >= exTime) {
        result[existingIdx] = {
          ...result[existingIdx],
          ...st,
          totalListings: preserveExistingMetrics ? result[existingIdx].totalListings : st.totalListings,
          inStockCount: preserveExistingMetrics ? result[existingIdx].inStockCount : st.inStockCount,
          discountedCount: preserveExistingMetrics ? result[existingIdx].discountedCount : st.discountedCount,
          averageDiscountPctAllInStock: preserveExistingMetrics ? result[existingIdx].averageDiscountPctAllInStock : st.averageDiscountPctAllInStock,
          bestDealOffers: (st.bestDealOffers && st.bestDealOffers.length > 0) ? st.bestDealOffers : result[existingIdx].bestDealOffers,
          scrapeTargetId: st.scrapeTargetId || result[existingIdx].scrapeTargetId,
          targetId: st.targetId || result[existingIdx].targetId,
          targetName: bestName || st.targetName || result[existingIdx].targetName,
          name: bestName || st.name || result[existingIdx].name,
          provider: stProvider,
          category: stProvider,
          rankedDeals: mergedDeals.length > 0 ? mergedDeals : result[existingIdx].rankedDeals,
          topDeals: mergedDeals.length > 0 ? mergedDeals.slice(0, 10).map((d, i) => ({ rank: i + 1, ...d })) : result[existingIdx].topDeals,
          bestDeal: bestRanked || result[existingIdx].bestDeal,
          bestEffectiveDeal: bestEff || result[existingIdx].bestEffectiveDeal,
        };
      } else {
        result[existingIdx] = {
          ...st,
          ...result[existingIdx],
          scrapeTargetId: result[existingIdx].scrapeTargetId || st.scrapeTargetId,
          targetId: result[existingIdx].targetId || st.targetId,
          targetName: bestName || result[existingIdx].targetName || st.targetName,
          name: bestName || result[existingIdx].name || st.name,
          provider: stProvider,
          category: stProvider,
          rankedDeals: mergedDeals.length > 0 ? mergedDeals : result[existingIdx].rankedDeals,
          topDeals: mergedDeals.length > 0 ? mergedDeals.slice(0, 10).map((d, i) => ({ rank: i + 1, ...d })) : result[existingIdx].topDeals,
          bestDeal: bestRanked || result[existingIdx].bestDeal,
          bestEffectiveDeal: bestEff || result[existingIdx].bestEffectiveDeal,
          bestDealOffers: (result[existingIdx].bestDealOffers && result[existingIdx].bestDealOffers.length > 0) ? result[existingIdx].bestDealOffers : st.bestDealOffers,
        };
      }
    }
  }

  return result;
}

