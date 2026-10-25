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

export const AMAZON_GIFT_CARDS_URL =
  "https://www.eneba.com/us/store/amazon-gift-cards";

export interface ScraperInitOptions {
  client?: ScraplingClient;
  categoryUrl?: string;
}

export class AmazonGiftCardScraper extends EnebaGiftCardScraper {
  constructor(options: ScraperInitOptions = {}) {
    super({
      categoryName: "Amazon Gift Cards",
      categoryUrl: options.categoryUrl ?? AMAZON_GIFT_CARDS_URL,
      client: options.client,
    });
  }
}

/**
 * Scrapes Amazon gift cards on Eneba and returns page status, top 10 deals, and best deal seller offers.
 */
export async function scrapeAmazonGiftCards({
  page = 1,
  useStealth = false,
  withOffers = true,
  showProgress = true,
  client,
}: ScrapeOptions & { client?: ScraplingClient } = {}): Promise<PageDealStatus> {
  const scraper = new AmazonGiftCardScraper({ client });
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
  const status = await scrapeAmazonGiftCards({
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
