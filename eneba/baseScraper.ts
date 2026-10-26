import { ScraplingClient, TerminalSpinner } from "../core/index.js";
import { analyzePageDeals, type PageDealStatus } from "./pageStats.js";

export const ENEBA_BASE_URL = "https://www.eneba.com";
export const ENEBA_PRODUCT_CARD_SELECTOR = "div.pFaGHa";
export const ENEBA_VENDOR_LINK_SELECTOR = "a[href*='/vendor/']";

export interface FaceValue {
  amount: number;
  currency: string;
}

export interface SellerOffer {
  sellerName: string;
  sellerSlug: string;
  sellerUrl: string;
  ratingScore: number | null;
  ratingLabel: string | null;
  price: number;
  cashbackPct: number;
  isLowestPrice: boolean;
  isFeaturedOffer: boolean;
}

export interface GiftCardListing {
  category: string;
  title: string;
  url: string;
  region: string;
  sellingPrice: number | null;
  originalPrice: number | null;
  faceValue: number | null;
  faceValueCurrency: string | null;
  listedDiscountPct: number | null;
  cashbackPct: number;
  inStock: boolean;
  discountPct: number;
  effectiveDiscountPct: number;
  effectivePrice: number | null;
  savingsAmount: number;
  offers?: SellerOffer[];
}

export interface ScrapeOptions {
  page?: number;
  useStealth?: boolean;
  /** Scrape competing seller offers on the best deal product page (default: true) */
  withOffers?: boolean;
  /** Show live terminal spinner / progress on stderr (default: true) */
  showProgress?: boolean;
}

export interface CliArgs {
  page: number;
  top: number;
  stealth: boolean;
  json: boolean;
  noDb: boolean;
  withOffers: boolean;
}

const FACE_VALUE_PATTERNS: Array<{ regex: RegExp; currency?: string }> = [
  // e.g. "100 USD", "50 EUR", "25 GBP", "20 CAD", "30 AUD", "100 BRL", "500 PLN"
  {
    regex:
      /\b(\d+(?:[.,]\d{1,2})?)\s*(USD|EUR|GBP|CAD|AUD|PLN|BRL|CHF|SEK|NOK|DKK|JPY|MXN|TRY|AED|SAR)\b/i,
  },
  // e.g. "$50", "$10.00"
  {
    regex: /\$\s*(\d+(?:[.,]\d{1,2})?)\b/,
    currency: "USD",
  },
  // e.g. "50$"
  {
    regex: /\b(\d+(?:[.,]\d{1,2})?)\s*\$/,
    currency: "USD",
  },
];

/**
 * Extracts face value and currency from a gift card product title when present.
 */
export function parseFaceValueFromTitle(title: string): FaceValue | null {
  for (const { regex, currency } of FACE_VALUE_PATTERNS) {
    const match = title.match(regex);
    if (match) {
      const amount = Number.parseFloat(match[1].replace(",", "."));
      const curr = currency ?? match[2].toUpperCase();
      if (Number.isFinite(amount) && amount > 0) {
        return { amount, currency: curr };
      }
    }
  }
  return null;
}

/**
 * Computes normalized discount & savings metrics for a listing.
 */
function computeListingMetrics(listing: {
  sellingPrice: number | null;
  originalPrice: number | null;
  faceValue: number | null;
  faceValueCurrency: string | null;
  listedDiscountPct: number | null;
  cashbackPct: number;
}): {
  discountPct: number;
  effectiveDiscountPct: number;
  effectivePrice: number | null;
  savingsAmount: number;
} {
  const {
    sellingPrice,
    originalPrice,
    faceValue,
    faceValueCurrency,
    listedDiscountPct,
    cashbackPct,
  } = listing;

  if (sellingPrice === null || !Number.isFinite(sellingPrice) || sellingPrice <= 0) {
    return {
      discountPct: 0,
      effectiveDiscountPct: 0,
      effectivePrice: null,
      savingsAmount: 0,
    };
  }

  let baselinePrice: number | null = originalPrice;
  if (
    baselinePrice === null &&
    faceValue !== null &&
    faceValueCurrency === "USD" &&
    faceValue >= sellingPrice * 0.5 &&
    faceValue <= sellingPrice * 2.5
  ) {
    baselinePrice = faceValue;
  }

  let discountPct = 0;
  let savingsAmount = 0;

  if (baselinePrice !== null && baselinePrice > sellingPrice) {
    savingsAmount = Number((baselinePrice - sellingPrice).toFixed(2));
    discountPct = Number(
      (((baselinePrice - sellingPrice) / baselinePrice) * 100).toFixed(2),
    );
  } else if (
    listedDiscountPct !== null &&
    Number.isFinite(listedDiscountPct) &&
    listedDiscountPct > 0
  ) {
    discountPct = Number(listedDiscountPct.toFixed(2));
  }

  // Cashback is ignored in calculation: effective price is direct selling price and effective discount is direct discount
  const effectivePrice = sellingPrice;
  const effectiveDiscountPct = discountPct;

  return {
    discountPct,
    effectiveDiscountPct,
    effectivePrice,
    savingsAmount,
  };
}

/**
 * Appends or updates the `?page=N` query parameter on an Eneba store URL.
 */
export function buildPageUrl(baseUrl: string, page = 1): string {
  if (page <= 1) {
    return baseUrl;
  }
  const url = new URL(baseUrl);
  url.searchParams.set("page", String(page));
  return url.toString();
}

export interface EnebaGiftCardScraperOptions {
  categoryName: string;
  categoryUrl: string;
  client?: ScraplingClient;
}

/**
 * Base scraper for Eneba gift card category listing pages.
 */
export class EnebaGiftCardScraper {
  public readonly categoryName: string;
  public readonly categoryUrl: string;
  public readonly client: ScraplingClient;

  constructor({
    categoryName,
    categoryUrl,
    client,
  }: EnebaGiftCardScraperOptions) {
    this.categoryName = categoryName;
    this.categoryUrl = categoryUrl;
    this.client = client ?? new ScraplingClient();
  }

  /**
   * Fetches raw product card Markdown blocks from an Eneba listing page.
   * Uses Scrapling's multi-tier fallback:
   * 1. Fast TLS-impersonated HTTP (`get`) or `stealthyFetch` with CSS selector `div.pFaGHa`
   * 2. Full-page Markdown extraction split by product cards
   * 3. `stealthyFetch` with `waitSelector: "div.pFaGHa"` and `solveCloudflare: true` if blocked
   */
  async fetchRawCards({
    page = 1,
    useStealth = false,
  }: ScrapeOptions = {}): Promise<string[]> {
    const targetUrl = buildPageUrl(this.categoryUrl, page);
    const fetchFn = useStealth
      ? this.client.stealthyFetch.bind(this.client)
      : this.client.get.bind(this.client);

    try {
      const response = await fetchFn(targetUrl, {
        extractionType: "markdown",
        cssSelector: ENEBA_PRODUCT_CARD_SELECTOR,
      });

      const validCards = response.content.filter((c) =>
        c.includes("[View offers]"),
      );
      if (validCards.length > 0) {
        return validCards;
      }
    } catch {
      // Fall through to full-page / stealth fallback
    }

    try {
      const fullPage = await fetchFn(targetUrl, {
        extractionType: "markdown",
      });
      const splitCards = this.splitFullPageMarkdownIntoCards(fullPage.text);
      if (splitCards.length > 0) {
        return splitCards;
      }
    } catch {
      // Fall through to stealthyFetch with waitSelector & Cloudflare solver
    }

    const stealthRes = await this.client.stealthyFetch(targetUrl, {
      extractionType: "markdown",
      cssSelector: ENEBA_PRODUCT_CARD_SELECTOR,
      waitSelector: ENEBA_PRODUCT_CARD_SELECTOR,
      solveCloudflare: true,
    });
    return stealthRes.content;
  }

  /**
   * Parses a single Eneba product card Markdown block into a structured GiftCardListing.
   */
  parseCardMarkdown(rawCard: string): GiftCardListing | null {
    if (!rawCard || !rawCard.includes("[View offers]")) {
      return null;
    }

    const lines = rawCard
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      return null;
    }

    // Extract [View offers](/us/...) link
    const linkMatch = rawCard.match(/\[View offers\]\(([^)]+)\)/);
    let url = this.categoryUrl;
    if (linkMatch) {
      const href = linkMatch[1].trim();
      url = href.startsWith("http") ? href : `${ENEBA_BASE_URL}${href}`;
    }

    // Filter out image markdown, offer links, and top overlay badges ("Cashback", "Promoted")
    const contentLines = lines.filter(
      (line) =>
        !line.startsWith("![") &&
        !line.startsWith("[View offers]") &&
        !/^(?:cashback|promoted)$/i.test(line),
    );
    if (contentLines.length === 0) {
      return null;
    }

    const title = contentLines[0];
    const region = contentLines[1] || "GLOBAL";

    const inStock = !/\bsold out\b/i.test(rawCard);

    // Crossed-out original price + percentage badge: e.g. "From $10.00-3%"
    let originalPrice: number | null = null;
    let listedDiscountPct: number | null = null;
    const crossedMatch = rawCard.match(
      /From\s*\$\s*(\d+(?:\.\d{1,2})?)\s*-\s*(\d+(?:\.\d+)?)%/i,
    );
    if (crossedMatch) {
      originalPrice = Number.parseFloat(crossedMatch[1]);
      listedDiscountPct = Number.parseFloat(crossedMatch[2]);
    }

    // Extract standalone selling price lines (e.g. "$9.69" or "From$48.99")
    let sellingPrice: number | null = null;
    for (const line of contentLines) {
      if (/^From\s*\$\s*\d+(?:\.\d{1,2})?\s*-\s*\d+/i.test(line)) {
        continue;
      }
      const priceMatch = line.match(/^(?:From\s*)?\$\s*(\d+(?:\.\d{1,2})?)$/i);
      if (priceMatch) {
        sellingPrice = Number.parseFloat(priceMatch[1]);
        break;
      }
    }

    // Fallback if price was embedded alongside other text
    if (sellingPrice === null && inStock) {
      const cleaned = rawCard.replace(
        /From\s*\$\s*\d+(?:\.\d{1,2})?\s*-\s*\d+(?:\.\d+)?%/gi,
        "",
      );
      const allPrices = [...cleaned.matchAll(/\$\s*(\d+(?:\.\d{1,2})?)/g)];
      if (allPrices.length > 0) {
        sellingPrice = Number.parseFloat(allPrices[0][1]);
      }
    }

    // Cashback is ignored in calculation and metrics
    const cashbackPct = 0;

    const faceValueInfo = parseFaceValueFromTitle(title);
    const faceValue = faceValueInfo ? faceValueInfo.amount : null;
    const faceValueCurrency = faceValueInfo ? faceValueInfo.currency : null;

    const metrics = computeListingMetrics({
      sellingPrice,
      originalPrice,
      faceValue,
      faceValueCurrency,
      listedDiscountPct,
      cashbackPct,
    });

    return {
      category: this.categoryName,
      title,
      url,
      region,
      sellingPrice,
      originalPrice,
      faceValue,
      faceValueCurrency,
      listedDiscountPct,
      cashbackPct,
      inStock,
      ...metrics,
    };
  }

  /**
   * Fallback parser if CSS selector changes on Eneba.
   */
  splitFullPageMarkdownIntoCards(markdown: string): string[] {
    if (!markdown) {
      return [];
    }
    const chunks = markdown.split(
      /(?=!\[[^\]]*\]\(https:\/\/products\.eneba\.games\/)/g,
    );
    return chunks.filter((chunk) => chunk.includes("[View offers]"));
  }

  /**
   * Scrapes and parses all gift card listings on the requested page.
   */
  async scrapePage({
    page = 1,
    useStealth = false,
  }: ScrapeOptions = {}): Promise<GiftCardListing[]> {
    const rawCards = await this.fetchRawCards({ page, useStealth });
    const listings: GiftCardListing[] = [];
    for (const rawCard of rawCards) {
      const parsed = this.parseCardMarkdown(rawCard);
      if (parsed) {
        listings.push(parsed);
      }
    }
    return listings;
  }

  /**
   * Parses vendor offers from an Eneba product detail page Markdown.
   */
  parseProductOffersMarkdown(markdown: string): SellerOffer[] {
    if (!markdown) {
      return [];
    }

    const offersSectionIdx = markdown.indexOf("Recommended offers");
    const relevantMd =
      offersSectionIdx !== -1 ? markdown.slice(offersSectionIdx) : markdown;

    // Split on vendor avatar image links: [![Vendor](...)](/us/vendor/...)
    const blocks = relevantMd.split(
      /(?=\[!\[[^\]]*\]\([^)]+\)\]\([^)]*\/vendor\/[^)]+\))/g,
    );
    const offers: SellerOffer[] = [];

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      // Match the standalone vendor link: [Vendor Name](/us/vendor/slug)
      const vendorMatch = block.match(
        /(?:^|\s)\[([^\][\n]+)\]\(([^)]*\/vendor\/([^)\s/]+))\)/m,
      );
      if (!vendorMatch) {
        continue;
      }

      const sellerName = vendorMatch[1].trim();
      const rawHref = vendorMatch[2].trim();
      const sellerSlug = vendorMatch[3].trim();
      const sellerUrl = rawHref.startsWith("http")
        ? rawHref
        : `${ENEBA_BASE_URL}${rawHref}`;

      // Cut block at "Safe Checkout Guaranteed" or "Gamers also viewed" if it's the last vendor block
      const cleanBlock = block.split(
        /Safe Checkout Guaranteed|Gamers also viewed|Product description/i,
      )[0];

      const priceMatch = cleanBlock.match(/\$\s*(\d+(?:\.\d{1,2})?)/);
      if (!priceMatch) {
        continue;
      }
      const price = Number.parseFloat(priceMatch[1]);
      if (!Number.isFinite(price) || price <= 0) {
        continue;
      }

      const ratingMatch = cleanBlock.match(
        /(\d+(?:\.\d+)?)\s*\*\*([^*]+)\*\*\s*rating/i,
      );
      const ratingScore = ratingMatch
        ? Number.parseFloat(ratingMatch[1])
        : null;
      const ratingLabel = ratingMatch ? ratingMatch[2].trim() : null;

      // Cashback is ignored in calculation and metrics
      const cashbackPct = 0;

      const isLowestPrice = /\bLowest price\b/i.test(cleanBlock);
      const isFeaturedOffer =
        i <= 1 &&
        !relevantMd.slice(0, relevantMd.indexOf(block)).includes("other offers");

      offers.push({
        sellerName,
        sellerSlug,
        sellerUrl,
        ratingScore,
        ratingLabel,
        price,
        cashbackPct,
        isLowestPrice,
        isFeaturedOffer,
      });
    }

    return offers;
  }

  /**
   * Fetches a product detail page using Scrapling's `stealthyFetch` + `waitSelector`
   * and extracts competing seller offers. Never throws if the product page is unreachable;
   * returns `[]` after fallback attempts so the main scrape result is never interrupted.
   */
  async scrapeProductOffers(productUrl: string): Promise<SellerOffer[]> {
    try {
      // Attempt 1: Stealth browser waiting specifically for vendor links to attach in DOM
      const res = await this.client.stealthyFetch(productUrl, {
        extractionType: "markdown",
        mainContentOnly: true,
        waitSelector: ENEBA_VENDOR_LINK_SELECTOR,
        waitMs: 500,
      });
      const offers = this.parseProductOffersMarkdown(res.text);
      if (offers.length > 0) {
        return offers;
      }

      // Attempt 2: Stealth browser with Cloudflare solver and 2000ms settle wait
      const fallbackRes = await this.client.stealthyFetch(productUrl, {
        extractionType: "markdown",
        mainContentOnly: true,
        solveCloudflare: true,
        waitMs: 2000,
      });
      return this.parseProductOffersMarkdown(fallbackRes.text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        `[Scrapling Warn] Could not scrape seller offers for ${productUrl}: ${msg}`,
      );
      return [];
    }
  }

  /**
   * Scrapes the category page, computes page status & top 10 deals, and optionally fetches
   * competing seller offers on the #1 best deal while displaying a live progress spinner in the terminal.
   */
  async scrapeAndAnalyze({
    page = 1,
    useStealth = false,
    withOffers = true,
    showProgress = true,
  }: ScrapeOptions = {}): Promise<PageDealStatus> {
    const spinner = new TerminalSpinner({ silent: !showProgress });
    spinner.start(
      `[${this.categoryName}] Fetching listing page ${page}...`,
    );

    const listings = await this.scrapePage({ page, useStealth });
    const initialStatus = analyzePageDeals(listings, {
      category: this.categoryName,
      pageUrl: buildPageUrl(this.categoryUrl, page),
      pageNumber: page,
    });

    const targetBest =
      initialStatus.bestEffectiveDeal || initialStatus.bestDeal;
    const bestLabel = targetBest
      ? `best deal: ${targetBest.effectiveDiscountPct.toFixed(2)}% off ($${targetBest.sellingPrice?.toFixed(2) ?? "N/A"})`
      : "no in-stock deals";
    spinner.succeed(
      `[${this.categoryName}] Scraped ${initialStatus.totalListings} cards (${initialStatus.inStockCount} in stock, ${bestLabel})`,
    );

    let bestDealOffers: SellerOffer[] = [];
    if (withOffers && targetBest) {
      spinner.start(
        `[${this.categoryName}] Fetching competing seller offers for "${targetBest.title}" (headless browser)...`,
      );
      bestDealOffers = await this.scrapeProductOffers(targetBest.url);
      if (bestDealOffers.length > 0) {
        spinner.succeed(
          `[${this.categoryName}] Fetched ${bestDealOffers.length} competing seller offers for "${targetBest.title}"`,
        );
      } else {
        spinner.warn(
          `[${this.categoryName}] No competing seller offers returned for "${targetBest.title}"`,
        );
      }
    }

    return analyzePageDeals(listings, {
      category: this.categoryName,
      pageUrl: buildPageUrl(this.categoryUrl, page),
      pageNumber: page,
      scrapedAt: initialStatus.scrapedAt,
      bestDealOffers,
    });
  }
}

/**
 * Parses common CLI flags (`--page`, `--top`, `--stealth`, `--json`, `--no-db`, `--no-offers`, `--with-offers`).
 * Note: `withOffers` is enabled (`true`) by default.
 */
export function parseCliArgs(argv: string[] = process.argv.slice(2)): CliArgs {
  const args: CliArgs = {
    page: 1,
    top: 10,
    stealth: false,
    json: false,
    noDb: false,
    withOffers: true,
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--page" && argv[i + 1]) {
      args.page = Math.max(1, Number.parseInt(argv[++i], 10) || 1);
    } else if (token === "--top" && argv[i + 1]) {
      args.top = Math.max(1, Number.parseInt(argv[++i], 10) || 10);
    } else if (token === "--stealth") {
      args.stealth = true;
    } else if (token === "--json") {
      args.json = true;
    } else if (token === "--no-db") {
      args.noDb = true;
    } else if (token === "--with-offers") {
      args.withOffers = true;
    } else if (token === "--no-offers") {
      args.withOffers = false;
    }
  }

  return args;
}
