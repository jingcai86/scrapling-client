import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { G2aGiftCardScraper } from "./scraper.js";

const SAMPLE_G2A_MARKDOWN = `
# Gift Cards on G2A

[Amazon Gift Card 100 USD Key UNITED STATES](https://www.g2a.com/amazon-gift-card-100-usd-key-united-states-i10000000001001)
From: $92.50
Region: UNITED STATES

[Apple iTunes Gift Card 50 USD Key GLOBAL](https://www.g2a.com/apple-itunes-gift-card-50-usd-key-global-i10000000002002)
Price: $45.00
Region: GLOBAL
`;

describe("G2aGiftCardScraper", () => {
  const scraper = new G2aGiftCardScraper();

  it("extracts face value and currency correctly from diverse title formats", () => {
    const r1 = scraper.parseFaceValue("Amazon Gift Card 100 USD Key UNITED STATES");
    assert.equal(r1.faceValue, 100);
    assert.equal(r1.currency, "USD");

    const r2 = scraper.parseFaceValue("Apple Gift Card $50 USA");
    assert.equal(r2.faceValue, 50);
    assert.equal(r2.currency, "USD");

    const r3 = scraper.parseFaceValue("PlayStation Network 25 EUR Key EUROPE");
    assert.equal(r3.faceValue, 25);
    assert.equal(r3.currency, "EUR");

    const r4 = scraper.parseFaceValue("Random Video Game (No Face Value)");
    assert.equal(r4.faceValue, null);
    assert.equal(r4.currency, null);
  });

  it("parses gift card listings from mock markdown response", () => {
    const listings = scraper.parseListings(SAMPLE_G2A_MARKDOWN);
    assert.ok(listings.length >= 2, `Expected at least 2 listings, got ${listings.length}`);

    const amazonListing = listings.find((l) => l.title.includes("Amazon"));
    assert.ok(amazonListing, "Amazon listing should be present");
    assert.equal(amazonListing?.faceValue, 100);
    assert.equal(amazonListing?.faceValueCurrency, "USD");
    assert.equal(amazonListing?.sellingPrice, 92.50);
    assert.equal(amazonListing?.region, "UNITED STATES");
    assert.ok(amazonListing?.discountPct && amazonListing.discountPct > 0);
    assert.equal(amazonListing?.category, scraper.siteCategory);
    assert.equal(amazonListing?.targetName, scraper.targetName);

    const itunesListing = listings.find((l) => l.title.includes("Apple"));
    assert.ok(itunesListing, "Apple listing should be present");
    assert.equal(itunesListing?.faceValue, 50);
    assert.equal(itunesListing?.sellingPrice, 45.00);
  });

  it("parses Google Play and PSN listings from G2A search and category results", () => {
    const markdown = `
# G2A Search Results for Google Play & PSN

[Google Play Gift Card 50 USD Key UNITED STATES](https://www.g2a.com/google-play-gift-card-50-usd-key-united-states-i10000000228063)
Price: $44.50
Region: UNITED STATES

[PlayStation Network Card 100 USD (USA) PSN Key UNITED STATES](https://www.g2a.com/playstation-network-card-100-usd-usa-psn-key-united-states-i10000000228064)
From: $89.99
Region: UNITED STATES

[PlayStation Network (PSN) Category Navigation](https://www.g2a.com/category/psn-c1567?page=2)
`;

    const g2aScraper = new G2aGiftCardScraper({
      category: "g2a",
      categoryName: "Google Play & PSN (G2A)",
      categoryUrl: "https://www.g2a.com/search?query=google%20play",
    });

    const listings = g2aScraper.parseListings(markdown);
    assert.equal(listings.length, 2, "Should parse the 2 product cards and skip navigation link");

    const googlePlay = listings.find((l) => l.title.includes("Google Play"));
    assert.ok(googlePlay, "Google Play listing should be extracted");
    assert.equal(googlePlay?.faceValue, 50);
    assert.equal(googlePlay?.sellingPrice, 44.50);
    assert.equal(googlePlay?.discountPct, 11);

    const psn = listings.find((l) => l.title.includes("PlayStation Network"));
    assert.ok(psn, "PSN listing should be extracted");
    assert.equal(psn?.faceValue, 100);
    assert.equal(psn?.sellingPrice, 89.99);
    assert.ok(psn?.discountPct && psn.discountPct > 10);
  });

  it("returns an empty array when parsing empty content", () => {
    const listings = scraper.parseListings("");
    assert.deepEqual(listings, []);
  });

  it("provides monitored fallback catalog listings and offers when direct access is WAF protected", () => {
    const googleScraper = new G2aGiftCardScraper({
      category: "g2a",
      targetName: "Google Play Gift Cards (G2A)",
      categoryUrl: "https://www.g2a.com/search?query=google%20play",
    });
    const googleFallbacks = googleScraper.getFallbackListings();
    assert.ok(googleFallbacks.length >= 3, "Google Play fallback should contain gift card listings");
    assert.ok(googleFallbacks.some((c) => c.title.includes("Google Play")));

    const psnScraper = new G2aGiftCardScraper({
      category: "g2a",
      targetName: "PlayStation (PSN) Gift Cards (G2A)",
      categoryUrl: "https://www.g2a.com/category/psn-c1567",
    });
    const psnFallbacks = psnScraper.getFallbackListings();
    assert.ok(psnFallbacks.length >= 3, "PSN fallback should contain gift card listings");
    assert.ok(psnFallbacks.some((c) => c.title.includes("PlayStation")));

    const fallbackOffers = psnScraper.getFallbackOffers("https://www.g2a.com/psn-100");
    assert.ok(fallbackOffers.length >= 2, "Fallback offers should return competing merchant offers");
    assert.ok(fallbackOffers[0].sellerName.length > 0);
  });
});
