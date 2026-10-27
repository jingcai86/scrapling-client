import type { GiftCardListing, SellerOffer } from "./baseScraper.js";
import type { DbPersistenceStatus } from "./db.js";

export interface RankedGiftCardListing extends GiftCardListing {
  rank: number;
}

export interface PageDealStatus {
  scrapedAt: string;
  category: string; // site name: "eneba", "g2a"
  targetId?: string;
  targetName?: string;
  name?: string; // alias for targetName
  pageUrl: string;
  pageNumber: number;
  totalListings: number;
  inStockCount: number;
  outOfStockCount: number;
  discountedCount: number;
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
  const rankedDeals = [...inStockListings].sort((a, b) => {
    if (b.discountPct !== a.discountPct) {
      return b.discountPct - a.discountPct;
    }
    if ((b.savingsAmount || 0) !== (a.savingsAmount || 0)) {
      return (b.savingsAmount || 0) - (a.savingsAmount || 0);
    }
    return (a.sellingPrice || 0) - (b.sellingPrice || 0);
  });

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
    targetId,
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
