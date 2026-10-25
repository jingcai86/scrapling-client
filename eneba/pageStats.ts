import type { GiftCardListing } from "./baseScraper.js";

export interface RankedGiftCardListing extends GiftCardListing {
  rank: number;
}

export interface PageDealStatus {
  scrapedAt: string;
  category: string;
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
  /** Top N (default 10) deals ranked 1..10 */
  topDeals: RankedGiftCardListing[];
  rankedDeals: GiftCardListing[];
}

export interface AnalyzePageOptions {
  category?: string;
  pageUrl?: string;
  pageNumber?: number;
  scrapedAt?: Date | string;
  topN?: number;
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
    category = "Eneba Gift Cards",
    pageUrl = "",
    pageNumber = 1,
    scrapedAt = new Date(),
    topN = 10,
  }: AnalyzePageOptions = {},
): PageDealStatus {
  const scrapedAtIso =
    scrapedAt instanceof Date ? scrapedAt.toISOString() : new Date(scrapedAt).toISOString();

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
  const averageEffectiveDiscountPct = mean(
    inStockListings.map((item) => item.effectiveDiscountPct),
  );

  // Sort in-stock listings by effectiveDiscountPct desc, then discountPct desc, then savingsAmount desc
  const rankedDeals = [...inStockListings].sort((a, b) => {
    if (b.effectiveDiscountPct !== a.effectiveDiscountPct) {
      return b.effectiveDiscountPct - a.effectiveDiscountPct;
    }
    if (b.discountPct !== a.discountPct) {
      return b.discountPct - a.discountPct;
    }
    return (b.savingsAmount || 0) - (a.savingsAmount || 0);
  });

  // Sort purely by direct discountPct desc for strict price-cut best deal
  const rankedByDirectDiscount = [...inStockListings].sort((a, b) => {
    if (b.discountPct !== a.discountPct) {
      return b.discountPct - a.discountPct;
    }
    if (b.effectiveDiscountPct !== a.effectiveDiscountPct) {
      return b.effectiveDiscountPct - a.effectiveDiscountPct;
    }
    return (b.savingsAmount || 0) - (a.savingsAmount || 0);
  });

  const bestDeal = rankedByDirectDiscount[0] ?? null;
  const bestEffectiveDeal = rankedDeals[0] ?? null;

  const maxDiscountPct = bestDeal ? bestDeal.discountPct : 0;
  const maxEffectiveDiscountPct = bestEffectiveDeal
    ? bestEffectiveDeal.effectiveDiscountPct
    : 0;

  const topDeals: RankedGiftCardListing[] = rankedDeals
    .slice(0, topN)
    .map((deal, idx) => ({
      rank: idx + 1,
      ...deal,
    }));

  return {
    scrapedAt: scrapedAtIso,
    category,
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
    `  • Avg Effective Discount (+CB)  : ${status.averageEffectiveDiscountPct.toFixed(2)}%`,
    `  • Max Direct Discount Seen      : ${status.maxDiscountPct.toFixed(2)}%`,
    `  • Max Effective Discount (+CB)  : ${status.maxEffectiveDiscountPct.toFixed(2)}%`,
  ];

  if (status.bestDeal) {
    const deal = status.bestDeal;
    const baseline =
      deal.originalPrice ??
      (deal.faceValueCurrency === "USD" ? deal.faceValue : null);
    lines.push(
      subDivider,
      `Best Direct Discount Deal on Page:`,
      `  • Title            : ${deal.title}`,
      `  • Region           : ${deal.region}`,
      `  • Selling Price    : ${formatPrice(deal.sellingPrice)}${baseline ? ` (Baseline: ${formatPrice(baseline)}, Save ${formatPrice(deal.savingsAmount)})` : ""}`,
      `  • Direct Discount  : ${deal.discountPct.toFixed(2)}%`,
      `  • Cashback         : ${deal.cashbackPct.toFixed(2)}% (Effective Price: ${formatPrice(deal.effectivePrice)}, Effective Discount: ${deal.effectiveDiscountPct.toFixed(2)}%)`,
      `  • Link             : ${deal.url}`,
    );
  } else {
    lines.push(subDivider, `Best Deal on Page: No in-stock listings found.`);
  }

  const dealsToShow = status.rankedDeals.slice(0, topN);
  if (dealsToShow.length > 0) {
    lines.push(
      subDivider,
      `Top ${dealsToShow.length} Deals (Ranked 1-${dealsToShow.length} by Effective Discount %):`,
    );
    dealsToShow.forEach((deal, idx) => {
      const rankStr = String(idx + 1).padStart(2);
      const priceStr = formatPrice(deal.sellingPrice).padStart(7);
      const discStr = `${deal.discountPct.toFixed(2)}%`.padStart(7);
      const cbStr = `${deal.cashbackPct.toFixed(1)}%`.padStart(6);
      const effStr = `${deal.effectiveDiscountPct.toFixed(2)}%`.padStart(7);
      lines.push(
        `  ${rankStr}. [Eff: ${effStr} | Disc: ${discStr} | CB: ${cbStr}] ${priceStr} — ${deal.title} (${deal.region})`,
      );
    });
  }

  lines.push(divider);
  return lines.join("\n");
}
