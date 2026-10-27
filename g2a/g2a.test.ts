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
    assert.equal(amazonListing?.category, scraper.categoryName);

    const itunesListing = listings.find((l) => l.title.includes("Apple"));
    assert.ok(itunesListing, "Apple listing should be present");
    assert.equal(itunesListing?.faceValue, 50);
    assert.equal(itunesListing?.sellingPrice, 45.00);
  });

  it("returns an empty array when parsing empty content", () => {
    const listings = scraper.parseListings("");
    assert.deepEqual(listings, []);
  });
});
