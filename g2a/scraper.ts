import {
  ScraplingClient,
  TerminalSpinner,
} from "../core/index.js";
import {
  type GiftCardListing,
  type SellerOffer,
  type ScrapeOptions,
} from "../eneba/baseScraper.js";
import {
  analyzePageDeals,
  type PageDealStatus,
} from "../eneba/pageStats.js";

export interface G2aGiftCardScraperOptions {
  categoryName?: string;
  categoryUrl?: string;
  client?: ScraplingClient;
}

const G2A_PRODUCT_CARD_SELECTOR = "div[class*='indexes__StyledCard'], li[class*='indexes__StyledOffersListItem']";

/**
 * G2A Gift Card Scraper and Deal Analyzer.
 * Uses Scrapling multi-tier fetching with graceful Akamai fallback.
 */
export class G2aGiftCardScraper {
  public readonly categoryName: string;
  public readonly categoryUrl: string;
  public readonly client: ScraplingClient;

  constructor({
    categoryName = "Amazon Gift Cards (G2A)",
    categoryUrl = "https://www.g2a.com/category/gift-cards-c6",
    client,
  }: G2aGiftCardScraperOptions = {}) {
    this.categoryName = categoryName;
    this.categoryUrl = categoryUrl;
    this.client = client ?? new ScraplingClient();
  }

  /**
   * Parses title into face value and currency if present.
   */
  public parseFaceValue(title: string): { faceValue: number | null; currency: string | null } {
    // E.g. "Amazon Gift Card 100 USD Key UNITED STATES", "$50", "25 EUR"
    const usdPattern = /\$(\d+(?:\.\d{1,2})?)/i;
    const codePattern = /(\d+(?:\.\d{1,2})?)\s*(USD|EUR|GBP|CAD|AUD)/i;

    const usdMatch = title.match(usdPattern);
    if (usdMatch) {
      return { faceValue: parseFloat(usdMatch[1]), currency: "USD" };
    }

    const codeMatch = title.match(codePattern);
    if (codeMatch) {
      return { faceValue: parseFloat(codeMatch[1]), currency: codeMatch[2].toUpperCase() };
    }

    return { faceValue: null, currency: null };
  }

  /**
   * Parses Markdown or HTML text extracted from G2A into structured GiftCardListing items.
   */
  public parseListings(content: string): GiftCardListing[] {
    const listings: GiftCardListing[] = [];
    if (!content || !content.trim()) return listings;

    // Pattern for Markdown links like [Amazon Gift Card 50 USD...](https://www.g2a.com/...)
    const linkRegex = /\[([^\]]+)\]\((https:\/\/(?:www\.)?g2a\.com\/[^\)]+)\)/gi;
    let match: RegExpExecArray | null;

    // Split text into chunks around markdown headings or links
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      linkRegex.lastIndex = 0;
      match = linkRegex.exec(line);
      if (match) {
        const title = match[1].trim();
        const url = match[2].trim();

        // Skip non-product navigational links
        if (
          /category|terms|privacy|help|about|contact|login|register/i.test(url) ||
          title.length < 5
        ) {
          continue;
        }

        // Look around subsequent lines for prices (e.g. $47.50, 5% off)
        const context = lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 5)).join(" ");
        const priceMatch = context.match(/(?:from\s*)?\$(\d+(?:\.\d{1,2})?)/i);
        const sellingPrice = priceMatch ? parseFloat(priceMatch[1]) : null;

        const { faceValue, currency } = this.parseFaceValue(title);
        const originalPrice = faceValue ?? (sellingPrice ? sellingPrice * 1.05 : null);

        let discountPct = 0;
        if (sellingPrice && originalPrice && originalPrice > sellingPrice) {
          discountPct = parseFloat((((originalPrice - sellingPrice) / originalPrice) * 100).toFixed(2));
        }

        const regionMatch = title.match(/\b(UNITED STATES|GLOBAL|EUROPE|US|EU|UK|CA)\b/i);
        const region = regionMatch ? regionMatch[1].toUpperCase() : "GLOBAL";

        listings.push({
          category: this.categoryName,
          title,
          url,
          region,
          sellingPrice,
          originalPrice,
          faceValue,
          faceValueCurrency: currency || "USD",
          listedDiscountPct: discountPct > 0 ? discountPct : null,
          cashbackPct: 0,
          inStock: true,
          discountPct,
          effectiveDiscountPct: discountPct,
          effectivePrice: sellingPrice,
          savingsAmount:
            originalPrice && sellingPrice && originalPrice > sellingPrice
              ? parseFloat((originalPrice - sellingPrice).toFixed(2))
              : 0,
        });
      }
    }

    return listings;
  }

  /**
   * Scrapes the target G2A gift card category page.
   */
  async scrapePage({
    useStealth = false,
  }: ScrapeOptions = {}): Promise<GiftCardListing[]> {
    try {
      const res = await this.client.fetchPage(this.categoryUrl, {
        extractionType: "markdown",
        stealth: useStealth,
        cssSelector: G2A_PRODUCT_CARD_SELECTOR,
      });

      if (res.status === 200 && res.text) {
        const parsed = this.parseListings(res.text);
        if (parsed.length > 0) return parsed;
      }

      if (res.status === 403) {
        console.warn(
          `[G2A Warn] Akamai Edge blocked direct access to ${this.categoryUrl} (HTTP 403). ` +
          `A residential proxy or browser cookie session is required for full G2A extraction.`,
        );
      }
    } catch (err: any) {
      console.warn(`[G2A Warn] Failed to fetch ${this.categoryUrl}: ${err.message}`);
    }

    return [];
  }

  /**
   * Extracts competing seller offers for a specific G2A gift card item.
   */
  async scrapeProductOffers(productUrl: string): Promise<SellerOffer[]> {
    try {
      const res = await this.client.fetchPage(productUrl, {
        extractionType: "markdown",
        stealth: true,
      });

      if (res.status === 200 && res.text) {
        // Parse seller lines: e.g. "SellerName Positive feedback 98% $48.50"
        const offers: SellerOffer[] = [];
        const lines = res.text.split("\n");
        for (const line of lines) {
          const match = line.match(/([a-zA-Z0-9_\-\s]+)\s+(?:Positive feedback\s+)?(\d+)%\s+\$(\d+(?:\.\d{1,2})?)/i);
          if (match) {
            const sellerName = match[1].trim();
            const ratingScore = parseInt(match[2], 10);
            const price = parseFloat(match[3]);
            offers.push({
              sellerName,
              sellerSlug: sellerName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
              sellerUrl: `https://www.g2a.com/user/${encodeURIComponent(sellerName)}`,
              ratingScore,
              ratingLabel: `${ratingScore}% positive`,
              price,
              cashbackPct: 0,
              isLowestPrice: offers.length === 0,
              isFeaturedOffer: offers.length === 0,
            });
          }
        }
        return offers;
      }
    } catch (err: any) {
      console.warn(`[G2A Warn] Could not fetch offers for ${productUrl}: ${err.message}`);
    }

    return [];
  }

  /**
   * Full scrape, analytics, and deal ranking for G2A pages.
   */
  async scrapeAndAnalyze({
    page = 1,
    useStealth = false,
    withOffers = true,
    showProgress = true,
  }: ScrapeOptions = {}): Promise<PageDealStatus> {
    const spinner = new TerminalSpinner({ silent: !showProgress });
    spinner.start(`[${this.categoryName}] Scraping G2A listings (${this.categoryUrl})...`);

    const listings = await this.scrapePage({ page, useStealth });
    const status = analyzePageDeals(listings, {
      category: this.categoryName,
      pageUrl: this.categoryUrl,
      pageNumber: page,
    });

    const bestDeal = status.bestEffectiveDeal || status.bestDeal;
    const countLabel = listings.length > 0 ? `${listings.length} cards found` : "0 cards (Akamai WAF protected)";
    spinner.succeed(`[${this.categoryName}] G2A Scrape complete: ${countLabel}`);

    if (withOffers && bestDeal) {
      spinner.start(`[${this.categoryName}] Fetching seller offers for "${bestDeal.title}"...`);
      const offers = await this.scrapeProductOffers(bestDeal.url);
      status.bestDealOffers = offers;
      spinner.succeed(`[${this.categoryName}] Retrieved ${offers.length} seller offer(s)`);
    }

    return status;
  }
}
