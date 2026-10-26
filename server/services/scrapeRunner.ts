import {
  ScraplingClient,
  getEmailConfigStatus,
  sendDealAlertEmail,
  type DealAlertItem,
  type EmailDispatchResult,
} from "../../core/index.js";
import { EnebaGiftCardScraper } from "../../eneba/baseScraper.js";
import {
  fetchLatestEnebaStatusesFromDb,
  getEnebaAlertThreshold,
  getEnebaTopDealsLimit,
  tryPersistScrapeResult,
  type DbPersistenceStatus,
} from "../../eneba/db.js";
import type { PageDealStatus } from "../../eneba/pageStats.js";
import type { PageStore, ScrapePageConfig } from "./pageStore.js";

export interface RunnerState {
  isScraping: boolean;
  currentStep: string | null;
  completedPages: number;
  totalPages: number;
  startedAt: string | null;
  lastCompletedAt: string | null;
  lastError: string | null;
  lastDbStatus: DbPersistenceStatus | null;
  lastEmailDispatch: EmailDispatchResult | null;
  recentLogs: string[];
}

/**
 * Converts `PageDealStatus[]` into normalized `DealAlertItem[]` for email threshold evaluation.
 */
export function statusesToAlertItems(
  statuses: PageDealStatus[],
  provider = "eneba",
): DealAlertItem[] {
  const items: DealAlertItem[] = [];
  for (const st of statuses) {
    const lowestSeller = st.bestDealOffers?.[0];
    for (const deal of st.rankedDeals) {
      const isBestDeal =
        (st.bestEffectiveDeal?.url && st.bestEffectiveDeal.url === deal.url) ||
        (st.bestDeal?.url && st.bestDeal.url === deal.url);

      items.push({
        provider,
        category: st.category,
        title: deal.title,
        url: deal.url,
        region: deal.region,
        sellingPrice: deal.sellingPrice,
        originalPrice: deal.originalPrice,
        faceValue: deal.faceValue,
        discountPct: deal.discountPct,
        cashbackPct: deal.cashbackPct,
        effectiveDiscountPct: deal.effectiveDiscountPct,
        effectivePrice: deal.effectivePrice,
        savingsAmount: deal.savingsAmount,
        lowestSellerName: isBestDeal ? lowestSeller?.sellerName : undefined,
        lowestSellerRating: isBestDeal ? lowestSeller?.ratingScore : undefined,
      });
    }
  }
  return items;
}

export class ScrapeRunner {
  private readonly pageStore: PageStore;
  private isScraping = false;
  private currentStep: string | null = null;
  private completedPages = 0;
  private totalPages = 0;
  private startedAt: string | null = null;
  private lastCompletedAt: string | null = null;
  private lastError: string | null = null;
  private lastDbStatus: DbPersistenceStatus | null = null;
  private lastEmailDispatch: EmailDispatchResult | null = null;
  private recentLogs: string[] = [];
  private statusesByCategory = new Map<string, PageDealStatus>();

  constructor(pageStore: PageStore) {
    this.pageStore = pageStore;
    for (const st of this.pageStore.loadLatestStatuses()) {
      this.statusesByCategory.set(st.category, st);
    }
    const emailStatus = getEmailConfigStatus();
    if (emailStatus.warningMessage) {
      this.addLog(`[Startup Warning] ${emailStatus.warningMessage}`);
    }
  }

  private addLog(message: string): void {
    const timestamp = new Date().toLocaleTimeString();
    const entry = `[${timestamp}] ${message}`;
    this.recentLogs.unshift(entry);
    if (this.recentLogs.length > 40) {
      this.recentLogs.length = 40;
    }
  }

  /**
   * Initializes cached statuses from PostgreSQL (`eneba.*` schema) if available.
   */
  async hydrateFromDatabase(): Promise<void> {
    try {
      const dbStatuses = await fetchLatestEnebaStatusesFromDb();
      if (dbStatuses.length > 0) {
        for (const st of dbStatuses) {
          const existing = this.statusesByCategory.get(st.category);
          if (
            !existing ||
            new Date(st.scrapedAt).getTime() >=
              new Date(existing.scrapedAt).getTime()
          ) {
            this.statusesByCategory.set(st.category, st);
          }
        }
        this.pageStore.saveLatestStatuses(this.getLatestStatuses());
        this.addLog(
          `Loaded ${dbStatuses.length} category snapshots from PostgreSQL (scrapling.eneba_* tables).`,
        );
      }
    } catch {
      // Non-blocking if DB is unavailable
    }
  }

  getLatestStatuses(): PageDealStatus[] {
    return Array.from(this.statusesByCategory.values());
  }

  getState(): RunnerState {
    return {
      isScraping: this.isScraping,
      currentStep: this.currentStep,
      completedPages: this.completedPages,
      totalPages: this.totalPages,
      startedAt: this.startedAt,
      lastCompletedAt: this.lastCompletedAt,
      lastError: this.lastError,
      lastDbStatus: this.lastDbStatus,
      lastEmailDispatch: this.lastEmailDispatch,
      recentLogs: [...this.recentLogs],
    };
  }

  /**
   * Runs a scrape job for a single page ID or all enabled pages.
   */
  async runScrape(options: {
    pageId?: string;
    withOffersOverride?: boolean;
  } = {}): Promise<PageDealStatus[]> {
    if (this.isScraping) {
      throw new Error("A scrape job is already running.");
    }

    const allPages = this.pageStore.listPages();
    const targetPages: ScrapePageConfig[] = options.pageId
      ? allPages.filter((p) => p.id === options.pageId)
      : allPages.filter((p) => p.enabled);

    if (targetPages.length === 0) {
      throw new Error(
        options.pageId
          ? `Scrape page "${options.pageId}" was not found.`
          : "No enabled scrape pages configured.",
      );
    }

    this.isScraping = true;
    this.startedAt = new Date().toISOString();
    this.completedPages = 0;
    this.totalPages = targetPages.length;
    this.lastError = null;
    this.currentStep = `Initializing Scrapling client for ${targetPages.length} page(s)...`;
    this.addLog(
      `Starting scrape for ${targetPages.length} page(s): ${targetPages.map((p) => p.categoryName).join(", ")}`,
    );

    const scrapedResults: PageDealStatus[] = [];

    try {
      const client = new ScraplingClient();

      for (let i = 0; i < targetPages.length; i++) {
        const pageCfg = targetPages[i];
        const useWithOffers =
          options.withOffersOverride !== undefined
            ? options.withOffersOverride
            : pageCfg.withOffers;

        this.currentStep = `Scraping (${i + 1}/${targetPages.length}) ${pageCfg.categoryName}${useWithOffers ? " + competing seller offers" : ""}...`;
        this.addLog(this.currentStep);

        const scraper = new EnebaGiftCardScraper({
          categoryName: pageCfg.categoryName,
          categoryUrl: pageCfg.url,
          client,
        });

        const status = await scraper.scrapeAndAnalyze({
          page: 1,
          withOffers: useWithOffers,
          showProgress: true,
        });

        scrapedResults.push(status);
        this.statusesByCategory.set(status.category, status);
        this.completedPages = i + 1;

        const best = status.bestEffectiveDeal || status.bestDeal;
        this.addLog(
          `Finished ${pageCfg.categoryName}: ${status.inStockCount}/${status.totalListings} in stock, best effective discount ${best ? best.effectiveDiscountPct.toFixed(2) + "%" : "0%"} (${status.bestDealOffers?.length ?? 0} competing offers).`,
        );
      }

      // Persist to local disk snapshot
      this.pageStore.saveLatestStatuses(scrapedResults);

      // Persist to PostgreSQL (fault-tolerant)
      this.currentStep = `Saving ${scrapedResults.length} page run(s) to PostgreSQL (scrapling.eneba_* tables)...`;
      const enebaLimit = await getEnebaTopDealsLimit().catch(() => 10);
      const dbStatus = await tryPersistScrapeResult(scrapedResults, {
        maxRank: enebaLimit,
        showProgress: true,
      });
      this.lastDbStatus = dbStatus;
      if (dbStatus.saved) {
        this.addLog(
          `PostgreSQL: Saved ${dbStatus.topDealsInserted} top deals & ${dbStatus.offersInserted ?? 0} seller offers (batch ${dbStatus.batchId?.slice(0, 8)}).`,
        );
      } else if (dbStatus.error) {
        this.addLog(`PostgreSQL Warning (skipped): ${dbStatus.error}`);
      } else {
        this.addLog(`PostgreSQL skipped (DATABASE_URL not set).`);
      }

      // Evaluate and send Resend deal alert email if threshold met
      this.currentStep = `Checking deals against discount alert threshold...`;
      const alertItems = statusesToAlertItems(scrapedResults);
      const enebaThreshold = await getEnebaAlertThreshold().catch(() => 20);
      const emailResult = await sendDealAlertEmail(alertItems, {
        thresholdPct: enebaThreshold,
      });
      this.lastEmailDispatch = emailResult;

      if (emailResult.sent) {
        this.addLog(
          `Resend Email Alert sent (${emailResult.matchingDealsCount} deal(s) >= ${emailResult.thresholdPct}% off, id: ${emailResult.messageId}).`,
        );
      } else if (emailResult.error) {
        this.addLog(`Resend Email Alert failed: ${emailResult.error}`);
      } else {
        this.addLog(
          `Email Alert not sent: ${emailResult.reason} (${emailResult.matchingDealsCount} matching deal(s) >= ${emailResult.thresholdPct}%).`,
        );
      }

      this.lastCompletedAt = new Date().toISOString();
      this.currentStep = null;
      return scrapedResults;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.lastError = msg;
      this.addLog(`Scrape error: ${msg}`);
      throw err;
    } finally {
      this.isScraping = false;
      this.currentStep = null;
    }
  }
}
