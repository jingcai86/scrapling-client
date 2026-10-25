import path from "node:path";
import { fileURLToPath } from "node:url";
import { ScraplingClient } from "../core/index.js";
import { parseCliArgs } from "./baseScraper.js";
import { formatPageStatusReport, type PageDealStatus } from "./pageStats.js";
import { scrapePlayStationGiftCards } from "./playstationGiftCard.js";
import { scrapeNintendoGiftCards } from "./nintendoGiftCard.js";
import { scrapeAndroidGiftCards } from "./androidGiftCard.js";
import { scrapeAmazonGiftCards } from "./amazonGiftCard.js";

/**
 * Formats an executive cross-category comparison table across all scraped Eneba gift card pages.
 */
export function formatCrossCategorySummary(statuses: PageDealStatus[]): string {
  const divider = "=".repeat(96);
  const lines: string[] = [
    divider,
    "ENEBA GIFT CARDS — CROSS-PAGE STATUS & BEST DEAL COMPARISON",
    divider,
    `${"Category".padEnd(34)} | ${"In Stock".padStart(8)} | ${"Avg Disc".padStart(8)} | ${"Avg Eff".padStart(8)} | ${"Best Deal (% / Price / Title)"}`,
    "-".repeat(96),
  ];

  for (const st of statuses) {
    const best = st.bestEffectiveDeal || st.bestDeal;
    const bestSummary = best
      ? `${best.effectiveDiscountPct.toFixed(2)}% ($${best.sellingPrice?.toFixed(2) ?? "N/A"}) — ${best.title}`
      : "None in stock";

    lines.push(
      `${st.category.padEnd(34)} | ${String(st.inStockCount).padStart(8)} | ${(st.averageDiscountPctOnDiscounted.toFixed(2) + "%").padStart(8)} | ${(st.averageEffectiveDiscountPct.toFixed(2) + "%").padStart(8)} | ${bestSummary}`,
    );
  }

  lines.push(divider);
  return lines.join("\n");
}

const isMain =
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const args = parseCliArgs();
  const client = new ScraplingClient();

  const scrapers = [
    scrapePlayStationGiftCards,
    scrapeNintendoGiftCards,
    scrapeAndroidGiftCards,
    scrapeAmazonGiftCards,
  ];

  const statuses: PageDealStatus[] = [];
  for (const scrapeFn of scrapers) {
    const status = await scrapeFn({
      page: args.page,
      useStealth: args.stealth,
      client,
    });
    statuses.push(status);
  }

  if (args.json) {
    console.log(JSON.stringify(statuses, null, 2));
  } else {
    for (const status of statuses) {
      console.log(formatPageStatusReport(status, { topN: args.top }));
      console.log("");
    }
    console.log(formatCrossCategorySummary(statuses));
  }
}
