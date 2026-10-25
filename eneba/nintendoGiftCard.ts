import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ScraplingClient } from "../core/index.js";
import {
  EnebaGiftCardScraper,
  buildPageUrl,
  parseCliArgs,
  type ScrapeOptions,
} from "./baseScraper.js";
import { savePageDealsToDb, saveProductOffersToDb } from "./db.js";
import {
  analyzePageDeals,
  formatPageStatusReport,
  type PageDealStatus,
} from "./pageStats.js";

export const NINTENDO_GIFT_CARDS_URL =
  "https://www.eneba.com/us/store/nintendo-gift-cards";

export interface ScraperInitOptions {
  client?: ScraplingClient;
  categoryUrl?: string;
}

export class NintendoGiftCardScraper extends EnebaGiftCardScraper {
  constructor(options: ScraperInitOptions = {}) {
    super({
      categoryName: "Nintendo eShop Gift Cards",
      categoryUrl: options.categoryUrl ?? NINTENDO_GIFT_CARDS_URL,
      client: options.client,
    });
  }
}

/**
 * Scrapes Nintendo eShop gift cards on Eneba and returns page status & best deal analytics.
 */
export async function scrapeNintendoGiftCards({
  page = 1,
  useStealth = false,
  client,
}: ScrapeOptions & { client?: ScraplingClient } = {}): Promise<PageDealStatus> {
  const scraper = new NintendoGiftCardScraper({ client });
  const listings = await scraper.scrapePage({ page, useStealth });
  return analyzePageDeals(listings, {
    category: scraper.categoryName,
    pageUrl: buildPageUrl(scraper.categoryUrl, page),
    pageNumber: page,
  });
}

const isMain =
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const args = parseCliArgs();
  const status = await scrapeNintendoGiftCards({
    page: args.page,
    useStealth: args.stealth,
  });

  if (args.json) {
    console.log(JSON.stringify(status, null, 2));
  } else {
    console.log(formatPageStatusReport(status, { topN: args.top }));
  }

  if (!args.noDb && process.env.DATABASE_URL) {
    const saved = await savePageDealsToDb(status, { maxRank: 10 });
    if (!args.json) {
      console.log(
        `[PostgreSQL] Stored ${saved.topDealsInserted} rows (rank 1-${saved.topDealsInserted}) into schema "eneba" at ${saved.scrapedAt} (batch: ${saved.batchId})`,
      );
    }
    if (args.withOffers && status.bestEffectiveDeal) {
      const scraper = new NintendoGiftCardScraper();
      const offers = await scraper.scrapeProductOffers(status.bestEffectiveDeal.url);
      const offerRes = await saveProductOffersToDb(status.bestEffectiveDeal.url, offers, {
        scrapedAt: saved.scrapedAt,
      });
      if (!args.json) {
        console.log(
          `[PostgreSQL] Stored ${offerRes.offersInserted} seller offers into eneba.sellers & eneba.product_offers`,
        );
      }
    }
  }
}
