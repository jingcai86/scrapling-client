import crypto from "node:crypto";
import {
  ScraplingClient,
  getEmailConfigStatus,
  sendDealAlertEmail,
  type DealAlertItem,
  type EmailDispatchResult,
} from "../../core/index.js";
import { EnebaGiftCardScraper } from "../../eneba/baseScraper.js";
import { G2aGiftCardScraper } from "../../g2a/index.js";
import {
  fetchLatestEnebaStatusesFromDb,
  fetchScrapeHistoryFromDb,
  getEnebaAlertThreshold,
  getEnebaTopDealsLimit,
  tryPersistScrapeResult,
  type DbPersistenceStatus,
} from "../../eneba/db.js";
import {
  deduplicatePageDealStatuses,
  getCanonicalProvider,
  getCanonicalTargetKey,
  type PageDealStatus,
} from "../../eneba/pageStats.js";
import type { PageStore, ScrapePageConfig, ScrapeHistoryItem } from "./pageStore.js";

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
        cashbackPct: 0,
        effectiveDiscountPct: deal.discountPct,
        effectivePrice: deal.sellingPrice,
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
  private scrapeHistory: ScrapeHistoryItem[] = [];
  private onScrapeCompleteListeners: Array<(statuses: PageDealStatus[]) => void> = [];

  constructor(pageStore: PageStore) {
    this.pageStore = pageStore;
    for (const st of this.pageStore.loadLatestStatuses()) {
      this.setStatus(st);
    }
    this.scrapeHistory = this.pageStore.loadHistory();
    const emailStatus = getEmailConfigStatus();
    if (emailStatus.warningMessage) {
      this.addLog(`[Startup Warning] ${emailStatus.warningMessage}`);
    }
  }

  private setStatus(status: PageDealStatus): void {
    if (!status) return;
    const stKey = getCanonicalTargetKey(status);
    const stProvider = getCanonicalProvider(status);
    const stId = (status.scrapeTargetId || status.targetId || "").trim();
    const stName = (status.targetName || status.name || "").trim().toLowerCase();
    const stUrl = (status.pageUrl || "").trim().toLowerCase();

    // Check if an existing status entry represents the same target
    for (const [key, existing] of this.statusesByCategory.entries()) {
      const exKey = getCanonicalTargetKey(existing);
      const exProvider = getCanonicalProvider(existing);
      if (stProvider !== exProvider) continue;

      const exId = (existing.scrapeTargetId || existing.targetId || "").trim();
      const exName = (existing.targetName || existing.name || "").trim().toLowerCase();
      const exUrl = (existing.pageUrl || "").trim().toLowerCase();

      const isMatch =
        (stKey && exKey && stKey === exKey) ||
        (stId && exId && stId === exId) ||
        (stName && exName && stName === exName) ||
        (stUrl && exUrl && (stUrl === exUrl || stUrl.split("?")[0] === exUrl.split("?")[0]));

      if (isMatch) {
        const exTime = new Date(existing.scrapedAt || 0).getTime();
        const stTime = new Date(status.scrapedAt || 0).getTime();
        this.statusesByCategory.delete(key);
        const preferStName =
          Boolean(status.targetName || status.name) &&
          !(status.targetName || status.name)!.toLowerCase().startsWith("http");
        const preferExName =
          Boolean(existing.targetName || existing.name) &&
          !(existing.targetName || existing.name)!.toLowerCase().startsWith("http");
        const bestName = preferStName
          ? (status.targetName || status.name)
          : preferExName
            ? (existing.targetName || existing.name)
            : (status.targetName || existing.targetName);

        const existingHasData =
          existing.totalListings > 0 ||
          Boolean(existing.bestDeal) ||
          (existing.rankedDeals && existing.rankedDeals.length > 0);
        const statusHasData =
          status.totalListings > 0 ||
          Boolean(status.bestDeal) ||
          (status.rankedDeals && status.rankedDeals.length > 0);

        if (!statusHasData && existingHasData) {
          status = {
            ...status,
            totalListings: existing.totalListings,
            inStockCount: existing.inStockCount,
            discountedCount: existing.discountedCount,
            averageDiscountPctAllInStock: existing.averageDiscountPctAllInStock,
            bestDeal: existing.bestDeal,
            bestEffectiveDeal: existing.bestEffectiveDeal,
            rankedDeals: existing.rankedDeals,
            topDeals: existing.topDeals,
            bestDealOffers: existing.bestDealOffers,
            scrapeTargetId: status.scrapeTargetId || existing.scrapeTargetId,
            targetId: status.targetId || existing.targetId,
            targetName: bestName || status.targetName || existing.targetName,
            name: bestName || status.name || existing.name,
            provider: stProvider,
            category: stProvider,
            scrapeCount: status.scrapeCount || existing.scrapeCount || 1,
            runStatus: status.runStatus || existing.runStatus || (existing.totalListings > 0 ? "success" : "warning"),
            faceAnalytics: status.faceAnalytics || existing.faceAnalytics,
            recentRuns: status.recentRuns?.length ? status.recentRuns : existing.recentRuns,
          };
        } else if (stTime < exTime) {
          status = {
            ...status,
            ...existing,
            scrapeTargetId: status.scrapeTargetId || existing.scrapeTargetId,
            targetId: status.targetId || existing.targetId,
            targetName: bestName || status.targetName || existing.targetName,
            name: bestName || status.name || existing.name,
            provider: stProvider,
            category: stProvider,
            scrapeCount: existing.scrapeCount || status.scrapeCount || 1,
            runStatus: existing.runStatus || status.runStatus || (existing.totalListings > 0 ? "success" : "warning"),
            faceAnalytics: existing.faceAnalytics || status.faceAnalytics,
            recentRuns: existing.recentRuns?.length ? existing.recentRuns : status.recentRuns,
          };
        } else {
          status = {
            ...existing,
            ...status,
            scrapeTargetId: status.scrapeTargetId || existing.scrapeTargetId,
            targetId: status.targetId || existing.targetId,
            targetName: bestName || status.targetName || existing.targetName,
            name: bestName || status.name || existing.name,
            provider: stProvider,
            category: stProvider,
            scrapeCount: status.scrapeCount || existing.scrapeCount || 1,
            runStatus: status.runStatus || existing.runStatus || (status.totalListings > 0 ? "success" : "warning"),
            faceAnalytics: status.faceAnalytics || existing.faceAnalytics,
            recentRuns: status.recentRuns?.length ? status.recentRuns : existing.recentRuns,
            totalListings: !statusHasData && existingHasData ? existing.totalListings : status.totalListings,
            inStockCount: !statusHasData && existingHasData ? existing.inStockCount : status.inStockCount,
            discountedCount: !statusHasData && existingHasData ? existing.discountedCount : status.discountedCount,
            averageDiscountPctAllInStock:
              status.averageDiscountPctAllInStock > 0
                ? status.averageDiscountPctAllInStock
                : existing.averageDiscountPctAllInStock > 0
                  ? existing.averageDiscountPctAllInStock
                  : status.averageDiscountPctAllInStock,
            bestDeal:
              status.bestDeal && status.bestDeal.discountPct > 0
                ? status.bestDeal
                : existing.bestDeal && existing.bestDeal.discountPct > 0
                  ? existing.bestDeal
                  : (status.bestDeal || existing.bestDeal),
            bestEffectiveDeal: status.bestEffectiveDeal || existing.bestEffectiveDeal,
            bestDealOffers: status.bestDealOffers?.length ? status.bestDealOffers : existing.bestDealOffers,
            rankedDeals: status.rankedDeals?.length ? status.rankedDeals : existing.rankedDeals,
            topDeals: status.topDeals?.length ? status.topDeals : existing.topDeals,
          };
        }
      }
    }

    const key =
      stKey ||
      status.scrapeTargetId ||
      status.targetId ||
      (status.targetName ? `${stProvider}:${status.targetName}` : null) ||
      (status.name ? `${stProvider}:${status.name}` : null) ||
      (status.pageUrl ? `${stProvider}:${status.pageUrl}` : null) ||
      status.category;

    this.statusesByCategory.set(key, status);
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
          this.setStatus(st);
        }
        this.pageStore.saveLatestStatuses(this.getLatestStatuses());
        this.addLog(
          `Loaded ${dbStatuses.length} category snapshots from PostgreSQL (scrapling schema tables).`,
        );
      }

      const dbHistory = await fetchScrapeHistoryFromDb(undefined, 30);
      if (dbHistory.length > 0) {
        const map = new Map<string, ScrapeHistoryItem>();
        for (const h of this.scrapeHistory) map.set(h.id, h);
        for (const h of dbHistory) map.set(h.id, h);
        this.scrapeHistory = Array.from(map.values()).sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
        );
        this.pageStore.saveHistory(this.scrapeHistory);
      }
    } catch {
      // Non-blocking if DB is unavailable
    }
  }

  getLatestStatuses(): PageDealStatus[] {
    return deduplicatePageDealStatuses(Array.from(this.statusesByCategory.values()));
  }

  getLatestScrapeTime(): Date | null {
    if (this.lastCompletedAt) {
      const dt = new Date(this.lastCompletedAt);
      if (!isNaN(dt.getTime())) return dt;
    }
    const statuses = this.getLatestStatuses();
    if (!statuses.length) return null;
    const timestamps = statuses
      .map((s) => new Date(s.scrapedAt).getTime())
      .filter((t) => !isNaN(t));
    if (!timestamps.length) return null;
    return new Date(Math.max(...timestamps));
  }

  onScrapeComplete(listener: (statuses: PageDealStatus[]) => void): void {
    this.onScrapeCompleteListeners.push(listener);
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
    pageIds?: string[];
    scheduleId?: string;
    provider?: string;
    withOffersOverride?: boolean;
  } = {}): Promise<PageDealStatus[]> {
    if (this.isScraping) {
      throw new Error("A scrape job is already running.");
    }

    const allPages = this.pageStore.listPages();
    let targetPages: ScrapePageConfig[];

    if (options.pageId) {
      targetPages = allPages.filter((p) => p.id === options.pageId);
    } else if (options.pageIds && options.pageIds.length > 0) {
      const idSet = new Set(options.pageIds);
      targetPages = allPages.filter((p) => idSet.has(p.id) && p.enabled);
    } else if (options.scheduleId) {
      targetPages = allPages.filter(
        (p) => (p.scheduleId || "default") === options.scheduleId && p.enabled,
      );
    } else if (options.provider) {
      targetPages = allPages.filter(
        (p) =>
          ((p.provider || p.category)?.toLowerCase() ===
            options.provider?.toLowerCase()) &&
          p.enabled,
      );
    } else {
      targetPages = allPages.filter((p) => p.enabled);
    }

    if (targetPages.length === 0) {
      throw new Error(
        options.pageId
          ? `Scrape page "${options.pageId}" was not found.`
          : options.scheduleId
            ? `No enabled scrape pages configured for schedule "${options.scheduleId}".`
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
            : (pageCfg.withOffers ?? true);

        this.currentStep = `Scraping (${i + 1}/${targetPages.length}) ${pageCfg.categoryName}${useWithOffers ? " + seller details" : ""}...`;
        this.addLog(this.currentStep);

        // Differentiate scraper implementation based on target category (e.g., eneba, g2a)
        const scraperCategory = (pageCfg.category || pageCfg.provider || "eneba").toLowerCase();
        let scraper: {
          scrapeAndAnalyze: (opts: {
            page: number;
            withOffers: boolean;
            showProgress: boolean;
          }) => Promise<PageDealStatus>;
        };

        switch (scraperCategory) {
          case "g2a":
            scraper = new G2aGiftCardScraper({
              category: "g2a",
              scrapeTargetId: pageCfg.id,
              targetId: pageCfg.id,
              targetName: pageCfg.name || pageCfg.categoryName,
              categoryUrl: pageCfg.url,
              client,
            });
            break;
          case "eneba":
          default:
            scraper = new EnebaGiftCardScraper({
              category: "eneba",
              scrapeTargetId: pageCfg.id,
              targetId: pageCfg.id,
              targetName: pageCfg.name || pageCfg.categoryName,
              categoryUrl: pageCfg.url,
              client,
            });
            break;
        }

        try {
          const status = await scraper.scrapeAndAnalyze({
            page: 1,
            withOffers: useWithOffers,
            showProgress: true,
          });

          scrapedResults.push(status);
          this.setStatus(status);
          this.completedPages = i + 1;

          const best = status.bestEffectiveDeal || status.bestDeal;
          this.addLog(
            `Finished ${pageCfg.name || pageCfg.categoryName}: ${status.inStockCount}/${status.totalListings} in stock, best effective discount ${best ? best.effectiveDiscountPct.toFixed(2) + "%" : "0%"} (${status.bestDealOffers?.length ?? 0} competing offers).`,
          );
        } catch (pageErr) {
          const errMsg = pageErr instanceof Error ? pageErr.message : String(pageErr);
          this.addLog(
            `[Warning] Scrape failed for ${pageCfg.name || pageCfg.categoryName}: ${errMsg}`,
          );
          this.completedPages = i + 1;
        }
      }

      // Persist to local disk snapshot
      this.pageStore.saveLatestStatuses(this.getLatestStatuses());

      // Persist to PostgreSQL (fault-tolerant)
      this.currentStep = `Saving ${scrapedResults.length} page run(s) to PostgreSQL (scrapling.records)...`;
      const enebaLimit = await getEnebaTopDealsLimit().catch(() => 10);
      const dbStatus = await tryPersistScrapeResult(scrapedResults, {
        maxRank: enebaLimit,
        showProgress: true,
      });
      this.lastDbStatus = dbStatus;
      if (dbStatus.saved) {
        this.addLog(
          `PostgreSQL: Saved ${dbStatus.recordsInserted ?? dbStatus.topDealsInserted} records (batch ${dbStatus.batchId?.slice(0, 8)}).`,
        );
      } else if (dbStatus.error) {
        this.addLog(`PostgreSQL Warning (skipped): ${dbStatus.error}`);
      } else {
        this.addLog(`PostgreSQL skipped (DATABASE_URL not set).`);
      }

      // Evaluate and send Resend deal alert email if threshold met
      this.currentStep = `Checking deals against provider discount alert thresholds...`;
      const alertItems = statusesToAlertItems(scrapedResults);
      const enebaThreshold = await getEnebaAlertThreshold().catch(() => 20);
      const providerThresholds: Record<string, number> = {
        eneba: enebaThreshold,
      };
      const emailResult = await sendDealAlertEmail(alertItems, {
        providerThresholds,
        thresholdPct: enebaThreshold,
      });
      this.lastEmailDispatch = emailResult;

      if (emailResult.sent) {
        this.addLog(
          `Resend Email Alert sent (${emailResult.matchingDealsCount} deal(s) met provider discount threshold, id: ${emailResult.messageId}).`,
        );
      } else if (emailResult.error) {
        this.addLog(`Resend Email Alert failed: ${emailResult.error}`);
      } else {
        this.addLog(
          `Email Alert not sent: ${emailResult.reason} (${emailResult.matchingDealsCount} matching deal(s)).`,
        );
      }

      this.lastCompletedAt = new Date().toISOString();

      const totalPages = targetPages.length;
      const successfulPages = scrapedResults.filter((s) => s.totalListings > 0).length;
      const successRate = totalPages > 0 ? Number(((successfulPages / totalPages) * 100).toFixed(1)) : 100;

      let bestItem: ScrapeHistoryItem["bestDeal"] = undefined;
      let highestDiscount = -1;
      const bestDealsByProvider: Record<string, NonNullable<ScrapeHistoryItem["bestDeal"]>> = {};

      for (const st of scrapedResults) {
        const prov = getCanonicalProvider(st);
        const top = st.bestDeal || st.bestEffectiveDeal || st.rankedDeals?.[0];
        if (!top) continue;

        const seller =
          st.bestDealOffers?.[0]?.sellerName ||
          top.offers?.[0]?.sellerName ||
          (top as any).lowestSellerName ||
          "Top Merchant";

        const provItem = {
          title: top.title,
          category: st.targetName || st.name || st.category,
          provider: prov,
          sellerName: seller,
          cost: top.sellingPrice ?? 0,
          faceValue: top.faceValue ?? top.originalPrice ?? 0,
          discountPct: top.discountPct,
          url: top.url,
        };

        const currentProv = bestDealsByProvider[prov];
        if (!currentProv || (top.discountPct ?? 0) > (currentProv.discountPct ?? 0)) {
          bestDealsByProvider[prov] = provItem;
        }

        if ((top.discountPct ?? 0) > highestDiscount) {
          highestDiscount = top.discountPct;
          bestItem = provItem;
        }
      }

      // Ensure all active providers have their latest best deal captured in bestDealsByProvider
      for (const st of this.getLatestStatuses()) {
        const prov = getCanonicalProvider(st);
        if (!bestDealsByProvider[prov]) {
          const top = st.bestDeal || st.bestEffectiveDeal || st.rankedDeals?.[0];
          if (top) {
            const seller =
              st.bestDealOffers?.[0]?.sellerName ||
              top.offers?.[0]?.sellerName ||
              (top as any).lowestSellerName ||
              "Top Merchant";
            bestDealsByProvider[prov] = {
              title: top.title,
              category: st.targetName || st.name || st.category,
              provider: prov,
              sellerName: seller,
              cost: top.sellingPrice ?? 0,
              faceValue: top.faceValue ?? top.originalPrice ?? 0,
              discountPct: top.discountPct,
              url: top.url,
            };
          }
        }
      }

      if (!bestItem) {
        const remainingDeals = Object.values(bestDealsByProvider);
        if (remainingDeals.length > 0) {
          remainingDeals.sort((a, b) => b.discountPct - a.discountPct);
          bestItem = remainingDeals[0];
        }
      }

      const historyItem: ScrapeHistoryItem = {
        id: dbStatus?.batchId || crypto.randomUUID(),
        provider: options.provider || (targetPages.length === 1 ? getCanonicalProvider(targetPages[0]) : undefined),
        timestamp: this.lastCompletedAt,
        totalPages,
        successfulPages,
        successRate,
        totalListings: scrapedResults.reduce((acc, s) => acc + (s.totalListings || 0), 0),
        inStockCount: scrapedResults.reduce((acc, s) => acc + (s.inStockCount || 0), 0),
        bestDeal: bestItem,
        bestDealsByProvider,
      };
      this.scrapeHistory.push(historyItem);
      this.pageStore.addHistoryItem(historyItem);

      for (const listener of this.onScrapeCompleteListeners) {
        try {
          listener(scrapedResults);
        } catch {}
      }
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

  getHistory(): ScrapeHistoryItem[] {
    if (this.scrapeHistory.length === 0 && this.statusesByCategory.size > 0) {
      const statuses = Array.from(this.statusesByCategory.values());
      const latestTime = this.getLatestScrapeTime() || new Date();
      const successfulPages = statuses.filter((s) => s.totalListings > 0).length;
      const totalPages = statuses.length;

      let bestItem: ScrapeHistoryItem["bestDeal"] = undefined;
      let highestDiscount = -1;
      const bestDealsByProvider: Record<string, NonNullable<ScrapeHistoryItem["bestDeal"]>> = {};

      for (const st of statuses) {
        const prov = getCanonicalProvider(st);
        const top = st.bestDeal || st.bestEffectiveDeal || st.rankedDeals?.[0];
        if (!top) continue;

        const seller =
          st.bestDealOffers?.[0]?.sellerName ||
          top.offers?.[0]?.sellerName ||
          (top as any).lowestSellerName ||
          "Top Merchant";

        const provItem = {
          title: top.title,
          category: st.targetName || st.name || st.category,
          provider: prov,
          sellerName: seller,
          cost: top.sellingPrice ?? 0,
          faceValue: top.faceValue ?? top.originalPrice ?? 0,
          discountPct: top.discountPct,
          url: top.url,
        };

        const currentProv = bestDealsByProvider[prov];
        if (!currentProv || (top.discountPct ?? 0) > (currentProv.discountPct ?? 0)) {
          bestDealsByProvider[prov] = provItem;
        }

        if ((top.discountPct ?? 0) > highestDiscount) {
          highestDiscount = top.discountPct;
          bestItem = provItem;
        }
      }

      // Ensure all active providers have their latest best deal captured in bestDealsByProvider
      for (const st of this.getLatestStatuses()) {
        const prov = getCanonicalProvider(st);
        if (!bestDealsByProvider[prov]) {
          const top = st.bestDeal || st.bestEffectiveDeal || st.rankedDeals?.[0];
          if (top) {
            const seller =
              st.bestDealOffers?.[0]?.sellerName ||
              top.offers?.[0]?.sellerName ||
              (top as any).lowestSellerName ||
              "Top Merchant";
            bestDealsByProvider[prov] = {
              title: top.title,
              category: st.targetName || st.name || st.category,
              provider: prov,
              sellerName: seller,
              cost: top.sellingPrice ?? 0,
              faceValue: top.faceValue ?? top.originalPrice ?? 0,
              discountPct: top.discountPct,
              url: top.url,
            };
          }
        }
      }

      if (!bestItem) {
        const remainingDeals = Object.values(bestDealsByProvider);
        if (remainingDeals.length > 0) {
          remainingDeals.sort((a, b) => b.discountPct - a.discountPct);
          bestItem = remainingDeals[0];
        }
      }

      return [
        {
          id: "initial-snapshot",
          timestamp: latestTime.toISOString(),
          totalPages,
          successfulPages,
          successRate: totalPages > 0 ? Number(((successfulPages / totalPages) * 100).toFixed(1)) : 100,
          totalListings: statuses.reduce((acc, s) => acc + (s.totalListings || 0), 0),
          inStockCount: statuses.reduce((acc, s) => acc + (s.inStockCount || 0), 0),
          bestDeal: bestItem,
          bestDealsByProvider,
        },
      ];
    }
    return [...this.scrapeHistory];
  }
}
