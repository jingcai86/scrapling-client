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

export const PLAYSTATION_GIFT_CARDS_URL =
  "https://www.eneba.com/us/store/psn-gift-cards";
export const NINTENDO_GIFT_CARDS_URL =
  "https://www.eneba.com/us/store/nintendo-gift-cards";
export const ANDROID_GIFT_CARDS_URL =
  "https://www.eneba.com/us/store/google-play-gift-cards";
export const AMAZON_GIFT_CARDS_URL =
  "https://www.eneba.com/us/store/amazon-gift-cards";
export const APPLE_GIFT_CARDS_URL =
  "https://www.eneba.com/us/store/apple-gift-cards";

export interface CategoryPreset {
  key: string;
  name: string;
  url: string;
}

export const ENEBA_PRESETS: Record<string, CategoryPreset> = {
  playstation: {
    key: "playstation",
    name: "PlayStation (PSN) Gift Cards",
    url: PLAYSTATION_GIFT_CARDS_URL,
  },
  nintendo: {
    key: "nintendo",
    name: "Nintendo eShop Gift Cards",
    url: NINTENDO_GIFT_CARDS_URL,
  },
  android: {
    key: "android",
    name: "Android (Google Play) Gift Cards",
    url: ANDROID_GIFT_CARDS_URL,
  },
  amazon: {
    key: "amazon",
    name: "Amazon Gift Cards",
    url: AMAZON_GIFT_CARDS_URL,
  },
  apple: {
    key: "apple",
    name: "Apple Gift Cards",
    url: APPLE_GIFT_CARDS_URL,
  },
};

export interface ScraperInitOptions {
  client?: ScraplingClient;
  categoryUrl?: string;
  categoryName?: string;
}

export type CategoryScrapeOptions = ScrapeOptions & { client?: ScraplingClient };

/**
 * Factory creating an Eneba scraper for a given category preset or custom URL.
 */
export function createEnebaCategoryScraper(
  presetKeyOrName: string,
  options: ScraperInitOptions = {},
): EnebaGiftCardScraper {
  const preset = ENEBA_PRESETS[presetKeyOrName.toLowerCase()];
  return new EnebaGiftCardScraper({
    categoryName: options.categoryName ?? preset?.name ?? presetKeyOrName,
    categoryUrl: options.categoryUrl ?? preset?.url ?? PLAYSTATION_GIFT_CARDS_URL,
    client: options.client,
  });
}

/**
 * Scrapes an Eneba gift card category and returns page deal status.
 */
export async function scrapeEnebaCategory(
  categoryKey: string,
  options: CategoryScrapeOptions = {},
): Promise<PageDealStatus> {
  const scraper = createEnebaCategoryScraper(categoryKey, { client: options.client });
  return scraper.scrapeAndAnalyze({
    page: options.page,
    useStealth: options.useStealth,
    withOffers: options.withOffers,
    showProgress: options.showProgress,
  });
}

// Preset Classes
export class PlayStationGiftCardScraper extends EnebaGiftCardScraper {
  constructor(options: ScraperInitOptions = {}) {
    super({
      categoryName: options.categoryName ?? ENEBA_PRESETS.playstation.name,
      categoryUrl: options.categoryUrl ?? PLAYSTATION_GIFT_CARDS_URL,
      client: options.client,
    });
  }
}

export class NintendoGiftCardScraper extends EnebaGiftCardScraper {
  constructor(options: ScraperInitOptions = {}) {
    super({
      categoryName: options.categoryName ?? ENEBA_PRESETS.nintendo.name,
      categoryUrl: options.categoryUrl ?? NINTENDO_GIFT_CARDS_URL,
      client: options.client,
    });
  }
}

export class AndroidGiftCardScraper extends EnebaGiftCardScraper {
  constructor(options: ScraperInitOptions = {}) {
    super({
      categoryName: options.categoryName ?? ENEBA_PRESETS.android.name,
      categoryUrl: options.categoryUrl ?? ANDROID_GIFT_CARDS_URL,
      client: options.client,
    });
  }
}

export class AmazonGiftCardScraper extends EnebaGiftCardScraper {
  constructor(options: ScraperInitOptions = {}) {
    super({
      categoryName: options.categoryName ?? ENEBA_PRESETS.amazon.name,
      categoryUrl: options.categoryUrl ?? AMAZON_GIFT_CARDS_URL,
      client: options.client,
    });
  }
}

export class AppleGiftCardScraper extends EnebaGiftCardScraper {
  constructor(options: ScraperInitOptions = {}) {
    super({
      categoryName: options.categoryName ?? ENEBA_PRESETS.apple.name,
      categoryUrl: options.categoryUrl ?? APPLE_GIFT_CARDS_URL,
      client: options.client,
    });
  }
}

// Named Scrape Functions
export const scrapePlayStationGiftCards = (opts: CategoryScrapeOptions = {}) =>
  scrapeEnebaCategory("playstation", opts);
export const scrapeNintendoGiftCards = (opts: CategoryScrapeOptions = {}) =>
  scrapeEnebaCategory("nintendo", opts);
export const scrapeAndroidGiftCards = (opts: CategoryScrapeOptions = {}) =>
  scrapeEnebaCategory("android", opts);
export const scrapeAmazonGiftCards = (opts: CategoryScrapeOptions = {}) =>
  scrapeEnebaCategory("amazon", opts);
export const scrapeAppleGiftCards = (opts: CategoryScrapeOptions = {}) =>
  scrapeEnebaCategory("apple", opts);

// CLI Runner
const isMain =
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const args = parseCliArgs();
  const categoryArg = process.argv
    .find((a) => a.startsWith("--category="))
    ?.split("=")[1] || "playstation";

  const status = await scrapeEnebaCategory(categoryArg, {
    page: args.page,
    useStealth: args.stealth,
    withOffers: args.withOffers,
  });

  const dbStatus = await tryPersistScrapeResult([status], {
    noDb: args.noDb,
    maxRank: args.top,
  });

  if (args.json) {
    console.log(JSON.stringify(status, null, 2));
  } else {
    console.log(formatPageStatusReport(status, { topN: args.top }));
    if (dbStatus.saved) {
      console.log(
        `\n[PostgreSQL] Stored top ${dbStatus.topDealsInserted} deals & ${dbStatus.offersInserted ?? 0} seller offers into schema "scrapling" (run: ${dbStatus.scrapeRunsInserted})`,
      );
    }
  }
}
