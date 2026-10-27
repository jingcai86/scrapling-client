import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  EnebaGiftCardScraper,
  parseCliArgs,
  parseFaceValueFromTitle,
} from "./baseScraper.js";
import { tryPersistScrapeResult } from "./db.js";
import {
  analyzePageDeals,
  deduplicatePageDealStatuses,
  formatPageStatusReport,
  type PageDealStatus,
} from "./pageStats.js";
import type { ScraplingClient } from "../core/index.js";

const SAMPLE_DISCOUNTED_CARD = `![](https://products.eneba.games/resized-products/sample1.jpg)

PlayStation Network Card 100 USD (USA) PSN Key UNITED STATES
United States

From

$100.00-14%

$86.00
5% Cashback

Save with Plus

Add to cart[View offers](/us/psn-playstation-network-card-psn-100-usd-usa-psn-key-united-states)`;

const SAMPLE_FACE_VALUE_IMPLIED_CARD = `![](https://products.eneba.games/resized-products/sample2.jpg)

Nintendo eShop Card 50 USD Key UNITED STATES
United States

From

$45.00
10% Cashback

Save with Plus

Add to cart[View offers](/us/nintendo-nintendo-eshop-card-50-usd-key-united-states)`;

const SAMPLE_SOLD_OUT_CARD = `![](https://products.eneba.games/resized-products/sample3.jpg)

Amazon Gift Card 25 USD Key UNITED STATES
United States

Sold out

[View offers](/us/other-amazon-gift-card-25-usd-key-united-states)`;

const mockClient = {
  mcpUrl: "http://localhost:8000/mcp",
} as unknown as ScraplingClient;

describe("Eneba Gift Card Parser & Page Status Analytics", () => {
  it("defaults withOffers to true and top to 10 in CLI args", () => {
    const defaults = parseCliArgs([]);
    assert.equal(defaults.withOffers, true);
    assert.equal(defaults.top, 10);

    const disabled = parseCliArgs(["--no-offers", "--no-db"]);
    assert.equal(disabled.withOffers, false);
    assert.equal(disabled.noDb, true);
  });

  it("parses face value and currency from product titles", () => {
    assert.deepEqual(
      parseFaceValueFromTitle(
        "PlayStation Network Card 100 USD (USA) PSN Key UNITED STATES",
      ),
      { amount: 100, currency: "USD" },
    );
    assert.deepEqual(
      parseFaceValueFromTitle("Google Play Gift Card 50 EUR Key EUROPE"),
      { amount: 50, currency: "EUR" },
    );
    assert.deepEqual(parseFaceValueFromTitle("Amazon Gift Card $25 Key"), {
      amount: 25,
      currency: "USD",
    });
  });

  it("parses discounted, face-value-implied, and sold-out Eneba cards accurately", () => {
    const scraper = new EnebaGiftCardScraper({
      categoryName: "Test Gift Cards",
      categoryUrl: "https://www.eneba.com/us/store/psn-gift-cards",
      client: mockClient,
    });

    const card1 = scraper.parseCardMarkdown(SAMPLE_DISCOUNTED_CARD);
    assert.ok(card1);
    assert.equal(
      card1.title,
      "PlayStation Network Card 100 USD (USA) PSN Key UNITED STATES",
    );
    assert.equal(card1.region, "United States");
    assert.equal(card1.originalPrice, 100);
    assert.equal(card1.sellingPrice, 86);
    assert.equal(card1.discountPct, 14);
    assert.equal(card1.cashbackPct, 0);
    assert.equal(card1.effectivePrice, 86);
    assert.equal(card1.effectiveDiscountPct, 14);
    assert.equal(card1.inStock, true);

    const card2 = scraper.parseCardMarkdown(SAMPLE_FACE_VALUE_IMPLIED_CARD);
    assert.ok(card2);
    assert.equal(card2.sellingPrice, 45);
    assert.equal(card2.faceValue, 50);
    assert.equal(card2.discountPct, 10);
    assert.equal(card2.cashbackPct, 0);
    assert.equal(card2.effectivePrice, 45);
    assert.equal(card2.effectiveDiscountPct, 10);

    const card3 = scraper.parseCardMarkdown(SAMPLE_SOLD_OUT_CARD);
    assert.ok(card3);
    assert.equal(card3.inStock, false);
    assert.equal(card3.sellingPrice, null);
  });

  it("computes average discount % and identifies the best deal on a page", () => {
    const scraper = new EnebaGiftCardScraper({
      categoryName: "Sample Gift Cards",
      categoryUrl: "https://www.eneba.com/us/store/sample-gift-cards",
      client: mockClient,
    });

    const listings = [
      SAMPLE_DISCOUNTED_CARD,
      SAMPLE_FACE_VALUE_IMPLIED_CARD,
      SAMPLE_SOLD_OUT_CARD,
    ]
      .map((md) => scraper.parseCardMarkdown(md))
      .filter((item): item is NonNullable<typeof item> => item !== null);

    const status = analyzePageDeals(listings, {
      category: scraper.siteCategory,
      targetName: scraper.targetName,
      pageUrl: scraper.categoryUrl,
    });

    assert.equal(status.totalListings, 3);
    assert.equal(status.inStockCount, 2);
    assert.equal(status.outOfStockCount, 1);
    assert.equal(status.discountedCount, 2);
    assert.equal(status.averageDiscountPctOnDiscounted, 12);
    assert.equal(status.averageDiscountPctAllInStock, 12);
    assert.equal(status.averageEffectiveDiscountPct, 12);

    assert.ok(status.bestDeal);
    assert.equal(status.bestDeal.discountPct, 14);
    assert.ok(status.bestEffectiveDeal);
    assert.equal(status.bestEffectiveDeal.discountPct, 14);

    const report = formatPageStatusReport(status, { topN: 2 });
    assert.match(report, /Avg Discount \(Discounted\)\s*:\s*12\.00%/);
    assert.match(report, /Best Deal on Page:/);
  });

  it("does not throw if PostgreSQL connection fails during tryPersistScrapeResult", async () => {
    const originalDbUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL =
      "postgresql://invalid:invalid@127.0.0.1:1/unreachable_db";

    try {
      const status = analyzePageDeals([], {
        category: "Sample Gift Cards",
        pageUrl: "https://www.eneba.com/us/store/sample-gift-cards",
      });
      const dbRes = await tryPersistScrapeResult(status);
      assert.equal(dbRes.saved, false);
      assert.equal(dbRes.skipped, false);
      assert.ok(dbRes.error);
      assert.equal(status.dbStatus?.saved, false);
    } finally {
      if (originalDbUrl !== undefined) {
        process.env.DATABASE_URL = originalDbUrl;
      } else {
        delete process.env.DATABASE_URL;
      }
    }
  });

  it("deduplicates category statuses by target key, name, and URL, retaining the latest scrape", () => {
    const rawStatuses: PageDealStatus[] = [
      {
        scrapedAt: "2026-10-25T10:00:00.000Z",
        category: "eneba",
        provider: "eneba",
        targetId: "playstation-network-psn",
        targetName: "PlayStation (PSN) Gift Cards",
        name: "PlayStation (PSN) Gift Cards",
        pageUrl: "https://www.eneba.com/store/gift-cards?platforms[]=playstation-network-psn",
        pageNumber: 1,
        totalListings: 10,
        inStockCount: 8,
        outOfStockCount: 2,
        discountedCount: 5,
        averageDiscountPctOnDiscounted: 10,
        averageDiscountPctAllInStock: 8,
        averageEffectiveDiscountPct: 8,
        maxDiscountPct: 15,
        maxEffectiveDiscountPct: 15,
        bestDeal: null,
        bestEffectiveDeal: null,
        bestDealOffers: [],
        topDeals: [],
        rankedDeals: [],
      },
      {
        scrapedAt: "2026-10-26T12:00:00.000Z",
        category: "eneba",
        provider: "eneba",
        targetName: "PlayStation (PSN) Gift Cards",
        name: "PlayStation (PSN) Gift Cards",
        pageUrl: "https://www.eneba.com/store/gift-cards?platforms[]=playstation-network-psn",
        pageNumber: 1,
        totalListings: 12,
        inStockCount: 10,
        outOfStockCount: 2,
        discountedCount: 6,
        averageDiscountPctOnDiscounted: 12,
        averageDiscountPctAllInStock: 9,
        averageEffectiveDiscountPct: 9,
        maxDiscountPct: 18,
        maxEffectiveDiscountPct: 18,
        bestDeal: null,
        bestEffectiveDeal: null,
        bestDealOffers: [],
        topDeals: [],
        rankedDeals: [],
      },
      {
        scrapedAt: "2026-10-27T08:00:00.000Z",
        category: "eneba",
        provider: "eneba",
        scrapeTargetId: "a1000000-0000-4000-8000-000000000001",
        targetId: "a1000000-0000-4000-8000-000000000001",
        targetName: "PlayStation (PSN) Gift Cards",
        name: "PlayStation (PSN) Gift Cards",
        pageUrl: "https://www.eneba.com/store/gift-cards?platforms[]=playstation-network-psn",
        pageNumber: 1,
        totalListings: 15,
        inStockCount: 14,
        outOfStockCount: 1,
        discountedCount: 8,
        averageDiscountPctOnDiscounted: 14,
        averageDiscountPctAllInStock: 11,
        averageEffectiveDiscountPct: 11,
        maxDiscountPct: 20,
        maxEffectiveDiscountPct: 20,
        bestDeal: null,
        bestEffectiveDeal: null,
        bestDealOffers: [],
        topDeals: [],
        rankedDeals: [],
      },
      {
        scrapedAt: "2026-10-27T08:30:00.000Z",
        category: "g2a",
        provider: "g2a",
        scrapeTargetId: "a1000000-0000-4000-8000-000000000009",
        targetId: "a1000000-0000-4000-8000-000000000009",
        targetName: "PlayStation (PSN) Gift Cards (G2A)",
        name: "PlayStation (PSN) Gift Cards (G2A)",
        pageUrl: "https://www.g2a.com/category/psn-c1567",
        pageNumber: 1,
        totalListings: 5,
        inStockCount: 5,
        outOfStockCount: 0,
        discountedCount: 3,
        averageDiscountPctOnDiscounted: 8,
        averageDiscountPctAllInStock: 6,
        averageEffectiveDiscountPct: 6,
        maxDiscountPct: 10,
        maxEffectiveDiscountPct: 10,
        bestDeal: null,
        bestEffectiveDeal: null,
        bestDealOffers: [],
        topDeals: [],
        rankedDeals: [],
      },
    ];

    const deduplicated = deduplicatePageDealStatuses(rawStatuses);
    // 3 duplicate PlayStation (PSN) entries for Eneba should collapse into 1, while G2A is preserved
    assert.equal(deduplicated.length, 2);

    const enebaPsn = deduplicated.find((s) => s.category === "eneba");
    assert.ok(enebaPsn);
    assert.equal(enebaPsn.scrapeTargetId, "a1000000-0000-4000-8000-000000000001");
    assert.equal(enebaPsn.scrapedAt, "2026-10-27T08:00:00.000Z");
    assert.equal(enebaPsn.totalListings, 15);

    const g2aPsn = deduplicated.find((s) => s.category === "g2a");
    assert.ok(g2aPsn);
    assert.equal(g2aPsn.scrapeTargetId, "a1000000-0000-4000-8000-000000000009");
  });
});
