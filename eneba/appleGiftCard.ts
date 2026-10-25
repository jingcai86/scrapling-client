import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ScraplingClient } from "../core/index.js";
import {
  EnebaGiftCardScraper,
  parseCliArgs,
  type ScrapeOptions,
} from "./baseScraper.js";
import { tryPersistScrapeResult } from "./db.js";
import {
  formatPageStatusReport,
  type PageDealStatus,
} from "./pageStats.js";

export const APPLE_GIFT_CARDS_URL =
  "https://www.eneba.com/us/store/apple-gift-cards";

export interface ScraperInitOptions {
  client?: ScraplingClient;
  categoryUrl?: string;
}

export class AppleGiftCardScraper extends EnebaGiftCardScraper {
  constructor(options: ScraperInitOptions = {}) {
    super({
      categoryName: "Apple Gift Cards",
      categoryUrl: options.categoryUrl ?? APPLE_GIFT_CARDS_URL,
      client: options.client,
    });
  }
}

/**
 * Scrapes Apple (App Store & iTunes) gift cards on Eneba and returns page status, top 10 deals, and competing seller offers.
 */
export async function scrapeAppleGiftCards({
  page = 1,
  useStealth = false,
  withOffers = true,
  showProgress = true,
  client,
}: ScrapeOptions & { client?: ScraplingClient } = {}): Promise<PageDealStatus> {
  const scraper = new AppleGiftCardScraper({ client });
  return scraper.scrapeAndAnalyze({
    page,
    useStealth,
    withOffers,
    showProgress,
  });
}

const isMain =
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const args = parseCliArgs();
  const status = await scrapeAppleGiftCards({
    page: args.page,
    useStealth: args.stealth,
    withOffers: args.withOffers,
  });

  await tryPersistScrapeResult(status, {
    noDb: args.noDb,
    maxRank: 10,
  });

  if (args.json) {
    console.log(JSON.stringify(status, null, 2));
  } else {
    console.log("");
    console.log(formatPageStatusReport(status, { topN: args.top }));
  }
}
