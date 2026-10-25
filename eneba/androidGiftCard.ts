import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ScraplingClient } from "../core/index.js";
import {
  EnebaGiftCardScraper,
  buildPageUrl,
  parseCliArgs,
  type ScrapeOptions,
  type SellerOffer,
} from "./baseScraper.js";
import { tryPersistScrapeResult } from "./db.js";
import {
  analyzePageDeals,
  formatPageStatusReport,
  type PageDealStatus,
} from "./pageStats.js";

export const ANDROID_GIFT_CARDS_URL =
  "https://www.eneba.com/us/store/google-play-gift-cards";

export interface ScraperInitOptions {
  client?: ScraplingClient;
  categoryUrl?: string;
}

export class AndroidGiftCardScraper extends EnebaGiftCardScraper {
  constructor(options: ScraperInitOptions = {}) {
    super({
      categoryName: "Android (Google Play) Gift Cards",
      categoryUrl: options.categoryUrl ?? ANDROID_GIFT_CARDS_URL,
      client: options.client,
    });
  }
}

/**
 * Scrapes Android (Google Play) gift cards on Eneba and returns page status, top 10 deals, and best deal seller offers.
 */
export async function scrapeAndroidGiftCards({
  page = 1,
  useStealth = false,
  withOffers = true,
  client,
}: ScrapeOptions & { client?: ScraplingClient } = {}): Promise<PageDealStatus> {
  const scraper = new AndroidGiftCardScraper({ client });
  const listings = await scraper.scrapePage({ page, useStealth });
  const initialStatus = analyzePageDeals(listings, {
    category: scraper.categoryName,
    pageUrl: buildPageUrl(scraper.categoryUrl, page),
    pageNumber: page,
  });

  let bestDealOffers: SellerOffer[] = [];
  const targetBest = initialStatus.bestEffectiveDeal || initialStatus.bestDeal;
  if (withOffers && targetBest) {
    bestDealOffers = await scraper.scrapeProductOffers(targetBest.url);
  }

  return analyzePageDeals(listings, {
    category: scraper.categoryName,
    pageUrl: buildPageUrl(scraper.categoryUrl, page),
    pageNumber: page,
    scrapedAt: initialStatus.scrapedAt,
    bestDealOffers,
  });
}

const isMain =
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const args = parseCliArgs();
  const status = await scrapeAndroidGiftCards({
    page: args.page,
    useStealth: args.stealth,
    withOffers: args.withOffers,
  });

  const dbStatus = await tryPersistScrapeResult(status, {
    noDb: args.noDb,
    maxRank: 10,
  });

  if (args.json) {
    console.log(JSON.stringify(status, null, 2));
  } else {
    console.log(formatPageStatusReport(status, { topN: args.top }));
    if (dbStatus.saved) {
      console.log(
        `[PostgreSQL] Stored ${dbStatus.topDealsInserted} top deals & ${dbStatus.offersInserted ?? 0} seller offers into schema "eneba" (batch: ${dbStatus.batchId})`,
      );
    }
  }
}
