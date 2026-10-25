import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ScraplingClient } from "../core/index.js";
import {
  EnebaGiftCardScraper,
  buildPageUrl,
  parseCliArgs,
  type ScrapeOptions,
} from "./baseScraper.js";
import {
  analyzePageDeals,
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
 * Scrapes Amazon gift cards on Eneba and returns page status & best deal analytics.
 */
export async function scrapeAmazonGiftCards({
  page = 1,
  useStealth = false,
  client,
}: ScrapeOptions & { client?: ScraplingClient } = {}): Promise<PageDealStatus> {
  const scraper = new AmazonGiftCardScraper({ client });
  const listings = await scraper.scrapePage({ page, useStealth });
  return analyzePageDeals(listings, {
    category: scraper.categoryName,
    pageUrl: buildPageUrl(scraper.categoryUrl, page),
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
  });

  if (args.json) {
    console.log(JSON.stringify(status, null, 2));
  } else {
    console.log(formatPageStatusReport(status, { topN: args.top }));
  }
}
