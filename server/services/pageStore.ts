import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_SCHEDULER_ID,
  isDefaultSchedulerId,
} from "../../core/index.js";
import {
  PLAYSTATION_GIFT_CARDS_URL,
  NINTENDO_GIFT_CARDS_URL,
  ANDROID_GIFT_CARDS_URL,
  AMAZON_GIFT_CARDS_URL,
  APPLE_GIFT_CARDS_URL,
} from "../../eneba/categories.js";
import {
  deduplicatePageDealStatuses,
  type PageDealStatus,
} from "../../eneba/pageStats.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const DEFAULT_DATA_DIR = path.resolve(REPO_ROOT, "data");

export interface ScrapePageConfig {
  id: string;
  productId?: string | null;
  productSlug?: string | null;
  productTitle?: string | null;
  category: string; // e.g. "eneba", "g2a" (scraper provider/category)
  provider?: string; // alias for category
  categoryName?: string; // e.g. "PlayStation (PSN) Gift Cards"
  name?: string; // alias for categoryName
  url: string; // derived from products.url
  enabled: boolean;
  withOffers?: boolean;
  createdAt: string;
  scheduleId?: string;
}

export interface ScheduleConfigItem {
  id: string;
  name: string;
  enabled: boolean;
  baseTime: string; // e.g. "19:00"
  jitterMinutes: number; // e.g. 60
  createdAt?: string;
}

export interface ScrapeHistoryItem {
  id: string;
  provider?: string;
  timestamp: string;
  totalPages: number;
  successfulPages: number;
  successRate: number; // 0..100
  totalListings: number;
  inStockCount: number;
  bestDeal?: {
    title: string;
    category: string;
    provider?: string;
    sellerName: string;
    cost: number;
    faceValue: number;
    discountPct: number;
    url?: string;
  };
  bestDealsByProvider?: Record<
    string,
    {
      title: string;
      category: string;
      provider?: string;
      sellerName: string;
      cost: number;
      faceValue: number;
      discountPct: number;
      url?: string;
    }
  >;
}

export const DEFAULT_SCHEDULES: ScheduleConfigItem[] = [
  {
    id: DEFAULT_SCHEDULER_ID,
    name: "Primary Daily Schedule",
    enabled: true,
    baseTime: "02:00",
    jitterMinutes: 60,
    createdAt: "2026-10-25T00:00:00.000Z",
  },
];

export const DEFAULT_SCRAPE_PAGES: ScrapePageConfig[] = [
  {
    id: "a1000000-0000-4000-8000-000000000001",
    productId: "0cbae1f0-59b3-4ac3-bcd1-3b7bbde05686",
    productSlug: "psn-40",
    category: "eneba",
    provider: "eneba",
    categoryName: "PlayStation (PSN) Gift Cards",
    name: "PlayStation (PSN) Gift Cards",
    url: PLAYSTATION_GIFT_CARDS_URL,
    enabled: true,
    withOffers: true,
    createdAt: "2026-10-25T00:00:00.000Z",
    scheduleId: DEFAULT_SCHEDULER_ID,
  },
  {
    id: "a1000000-0000-4000-8000-000000000005",
    productId: "f700d89a-919a-4e82-9eb6-c92f7853c2a2",
    productSlug: "nintendo-10",
    category: "eneba",
    provider: "eneba",
    categoryName: "Nintendo eShop Gift Cards",
    name: "Nintendo eShop Gift Cards",
    url: NINTENDO_GIFT_CARDS_URL,
    enabled: true,
    withOffers: true,
    createdAt: "2026-10-25T00:00:00.000Z",
    scheduleId: DEFAULT_SCHEDULER_ID,
  },
  {
    id: "a1000000-0000-4000-8000-000000000003",
    productId: "3a8bd30c-620d-48a3-aa66-f976f9ecaa50",
    productSlug: "google-play-10",
    category: "eneba",
    provider: "eneba",
    categoryName: "Android (Google Play) Gift Cards",
    name: "Android (Google Play) Gift Cards",
    url: ANDROID_GIFT_CARDS_URL,
    enabled: true,
    withOffers: true,
    createdAt: "2026-10-25T00:00:00.000Z",
    scheduleId: DEFAULT_SCHEDULER_ID,
  },
  {
    id: "a1000000-0000-4000-8000-000000000006",
    productId: "28519d1d-0742-4e92-b28f-f8e34cd60630",
    productSlug: "amazon-10",
    category: "eneba",
    provider: "eneba",
    categoryName: "Amazon Gift Cards",
    name: "Amazon Gift Cards",
    url: AMAZON_GIFT_CARDS_URL,
    enabled: true,
    withOffers: true,
    createdAt: "2026-10-25T00:00:00.000Z",
    scheduleId: DEFAULT_SCHEDULER_ID,
  },
  {
    id: "a1000000-0000-4000-8000-000000000002",
    productId: "c56cb9eb-0773-472e-a530-ee72d5863c3a",
    productSlug: "apple-10",
    category: "eneba",
    provider: "eneba",
    categoryName: "Apple Gift Cards",
    name: "Apple Gift Cards",
    url: APPLE_GIFT_CARDS_URL,
    enabled: true,
    createdAt: "2026-10-25T00:00:00.000Z",
    scheduleId: DEFAULT_SCHEDULER_ID,
  },
  {
    id: "a1000000-0000-4000-8000-000000000004",
    productId: "b1000000-0000-4000-8000-000000000004",
    productSlug: "steam-20",
    category: "eneba",
    provider: "eneba",
    categoryName: "Steam Gift Cards & Wallet Codes",
    name: "Steam Gift Cards & Wallet Codes",
    url: "https://www.eneba.com/store/gift-cards?regions[]=united_states&types[]=gift_card&platforms[]=steam",
    enabled: true,
    createdAt: "2026-10-25T00:00:00.000Z",
    scheduleId: DEFAULT_SCHEDULER_ID,
  },
  {
    id: "a1000000-0000-4000-8000-000000000008",
    productId: "ad69d4d6-a0fd-49dd-a439-e983f3af32b4",
    productSlug: "g2a-google-play",
    productTitle: "Google Play Gift Cards (G2A)",
    category: "g2a",
    provider: "g2a",
    categoryName: "Google Play Gift Cards (G2A)",
    name: "Google Play Gift Cards (G2A)",
    url: "https://www.g2a.com/search?query=google%20play",
    enabled: true,
    createdAt: "2026-10-25T00:00:00.000Z",
    scheduleId: DEFAULT_SCHEDULER_ID,
  },
  {
    id: "a1000000-0000-4000-8000-000000000009",
    productId: "ad69d4d6-a0fd-49dd-a439-e983f3af32b5",
    productSlug: "g2a-psn",
    productTitle: "PlayStation (PSN) Gift Cards (G2A)",
    category: "g2a",
    provider: "g2a",
    categoryName: "PlayStation (PSN) Gift Cards (G2A)",
    name: "PlayStation (PSN) Gift Cards (G2A)",
    url: "https://www.g2a.com/category/psn-c1567",
    enabled: true,
    createdAt: "2026-10-25T00:00:00.000Z",
    scheduleId: DEFAULT_SCHEDULER_ID,
  },
];

export class PageStore {
  private pages: ScrapePageConfig[];
  private schedules: ScheduleConfigItem[];
  private history: ScrapeHistoryItem[] = [];
  private readonly resultsFilePath: string;

  constructor(dataDir: string = DEFAULT_DATA_DIR) {
    fs.mkdirSync(dataDir, { recursive: true });
    this.resultsFilePath = path.join(dataDir, "latest-results.json");
    this.pages = [...DEFAULT_SCRAPE_PAGES];
    this.schedules = [...DEFAULT_SCHEDULES];
  }

  /**
   * Lists all configured scraping pages.
   */
  listPages(): ScrapePageConfig[] {
    return this.pages.map((p) => ({
      ...p,
      scheduleId: p.scheduleId ? (isDefaultSchedulerId(p.scheduleId) ? DEFAULT_SCHEDULER_ID : p.scheduleId) : DEFAULT_SCHEDULER_ID,
    }));
  }

  savePages(pages: ScrapePageConfig[]): void {
    this.pages = pages.map((p) => ({
      ...p,
      scheduleId: p.scheduleId ? (isDefaultSchedulerId(p.scheduleId) ? DEFAULT_SCHEDULER_ID : p.scheduleId) : DEFAULT_SCHEDULER_ID,
    }));
  }

  listSchedules(): ScheduleConfigItem[] {
    if (!this.schedules.some((s) => isDefaultSchedulerId(s.id))) {
      this.schedules.unshift(DEFAULT_SCHEDULES[0]);
    }
    return [...this.schedules];
  }

  saveSchedules(schedules: ScheduleConfigItem[]): void {
    this.schedules = [...schedules];
  }

  getSchedule(id: string): ScheduleConfigItem | undefined {
    return this.listSchedules().find((s) => s.id === id || (isDefaultSchedulerId(s.id) && isDefaultSchedulerId(id)));
  }

  addSchedule(input: {
    name: string;
    baseTime: string;
    jitterMinutes: number;
    enabled?: boolean;
  }): ScheduleConfigItem {
    const list = this.listSchedules();
    const id = crypto.randomUUID();
    const item: ScheduleConfigItem = {
      id,
      name: input.name?.trim() || "Custom Schedule",
      baseTime: input.baseTime?.trim() || "02:00",
      jitterMinutes: Math.max(0, Math.min(720, Number(input.jitterMinutes) || 0)),
      enabled: input.enabled !== undefined ? Boolean(input.enabled) : true,
      createdAt: new Date().toISOString(),
    };
    list.push(item);
    this.saveSchedules(list);
    return item;
  }

  updateSchedule(
    id: string,
    patch: Partial<Omit<ScheduleConfigItem, "id" | "createdAt">>,
  ): ScheduleConfigItem | null {
    const list = this.listSchedules();
    const idx = list.findIndex((s) => s.id === id || (isDefaultSchedulerId(s.id) && isDefaultSchedulerId(id)));
    if (idx === -1) return null;

    const current = list[idx];
    const updated: ScheduleConfigItem = {
      ...current,
      name: patch.name !== undefined && patch.name.trim() ? patch.name.trim() : current.name,
      baseTime: patch.baseTime !== undefined ? patch.baseTime.trim() : current.baseTime,
      jitterMinutes:
        patch.jitterMinutes !== undefined
          ? Math.max(0, Math.min(720, Number(patch.jitterMinutes) || 0))
          : current.jitterMinutes,
      enabled: patch.enabled !== undefined ? Boolean(patch.enabled) : current.enabled,
    };
    list[idx] = updated;
    this.saveSchedules(list);
    return updated;
  }

  deleteSchedule(id: string): boolean {
    if (isDefaultSchedulerId(id)) return false; // Default cannot be deleted
    const list = this.listSchedules();
    const filtered = list.filter((s) => s.id !== id);
    if (filtered.length === list.length) return false;

    this.saveSchedules(filtered);

    // Reassign any pages that used this schedule back to DEFAULT_SCHEDULER_ID
    const pages = this.listPages();
    let pagesChanged = false;
    for (const p of pages) {
      if (p.scheduleId === id) {
        p.scheduleId = DEFAULT_SCHEDULER_ID;
        pagesChanged = true;
      }
    }
    if (pagesChanged) {
      this.savePages(pages);
    }
    return true;
  }

  assignPageSchedule(pageId: string, scheduleId: string): ScrapePageConfig | null {
    const pages = this.listPages();
    const page = pages.find((p) => p.id === pageId);
    if (!page) return null;

    page.scheduleId = scheduleId?.trim() ? (isDefaultSchedulerId(scheduleId) ? DEFAULT_SCHEDULER_ID : scheduleId.trim()) : DEFAULT_SCHEDULER_ID;
    this.savePages(pages);
    return page;
  }

  getAssignedPagesMap(): Record<string, string[]> {
    const map: Record<string, string[]> = {};
    const pages = this.listPages();
    for (const p of pages) {
      const sId = p.scheduleId ? (isDefaultSchedulerId(p.scheduleId) ? DEFAULT_SCHEDULER_ID : p.scheduleId) : DEFAULT_SCHEDULER_ID;
      if (!map[sId]) map[sId] = [];
      map[sId].push(p.id);
    }
    return map;
  }

  /**
   * Adds a new scraping page to the store.
   */
  addPage(input: {
    productId?: string | null;
    productSlug?: string | null;
    productTitle?: string | null;
    provider?: string;
    category?: string;
    categoryName?: string;
    name?: string;
    url?: string;
    enabled?: boolean;
    withOffers?: boolean;
    scheduleId?: string;
  }): ScrapePageConfig {
    const pages = this.listPages();
    const category = (input.category || input.provider || "eneba").trim().toLowerCase();
    let categoryName = (input.categoryName || input.name || input.productTitle || "").trim();
    const rawUrl = (input.url || "").trim();

    let finalUrl = rawUrl;
    if (rawUrl) {
      try {
        const parsed = new URL(rawUrl);
        finalUrl = parsed.toString();
        if (!categoryName) {
          const segments = parsed.pathname.split("/").filter(Boolean);
          categoryName = segments.length > 0 ? segments[segments.length - 1].replace(/[-_]/g, " ") : parsed.hostname;
        }
      } catch {
        // Ignore invalid URL formatting if it's a slug or placeholder
      }
    }

    const id = crypto.randomUUID();

    const newPage: ScrapePageConfig = {
      id,
      productId: input.productId ?? null,
      productSlug: input.productSlug ?? null,
      productTitle: input.productTitle ?? null,
      category,
      provider: category,
      categoryName: categoryName || "Scraping Target",
      name: categoryName || "Scraping Target",
      url: finalUrl,
      enabled: input.enabled ?? true,
      withOffers: input.withOffers ?? true,
      createdAt: new Date().toISOString(),
      scheduleId: input.scheduleId?.trim() ? (isDefaultSchedulerId(input.scheduleId) ? DEFAULT_SCHEDULER_ID : input.scheduleId.trim()) : DEFAULT_SCHEDULER_ID,
    };

    pages.push(newPage);
    this.savePages(pages);
    return newPage;
  }

  /**
   * Updates an existing scraping page by ID.
   */
  updatePage(
    id: string,
    patch: Partial<
      Pick<
        ScrapePageConfig,
        | "productId"
        | "productSlug"
        | "productTitle"
        | "categoryName"
        | "name"
        | "url"
        | "provider"
        | "category"
        | "enabled"
        | "withOffers"
        | "scheduleId"
      >
    >,
  ): ScrapePageConfig | null {
    const pages = this.listPages();
    const idx = pages.findIndex((p) => p.id === id);
    if (idx === -1) return null;

    const current = pages[idx];
    const category =
      patch.category !== undefined
        ? patch.category.trim().toLowerCase() || current.category || "eneba"
        : patch.provider !== undefined
          ? patch.provider.trim().toLowerCase() || current.category || "eneba"
          : current.category || "eneba";
    const categoryName =
      patch.categoryName !== undefined && patch.categoryName.trim()
        ? patch.categoryName.trim()
        : patch.name !== undefined && patch.name.trim()
          ? patch.name.trim()
          : current.categoryName || current.name;

    const url =
      patch.url !== undefined
        ? patch.url.trim()
        : current.url;

    const updated: ScrapePageConfig = {
      ...current,
      productId: patch.productId !== undefined ? patch.productId : current.productId,
      productSlug: patch.productSlug !== undefined ? patch.productSlug : current.productSlug,
      productTitle: patch.productTitle !== undefined ? patch.productTitle : current.productTitle,
      category,
      provider: category,
      categoryName,
      name: categoryName,
      url,
      enabled: patch.enabled !== undefined ? Boolean(patch.enabled) : current.enabled,
      withOffers: patch.withOffers !== undefined ? Boolean(patch.withOffers) : current.withOffers,
      scheduleId:
        patch.scheduleId !== undefined
          ? patch.scheduleId.trim()
            ? isDefaultSchedulerId(patch.scheduleId)
              ? DEFAULT_SCHEDULER_ID
              : patch.scheduleId.trim()
            : DEFAULT_SCHEDULER_ID
          : current.scheduleId,
    };

    pages[idx] = updated;
    this.savePages(pages);
    return updated;
  }

  /**
   * Deletes a scraping page by ID.
   */
  deletePage(id: string): boolean {
    const pages = this.listPages();
    const filtered = pages.filter((p) => p.id !== id);
    if (filtered.length === pages.length) return false;
    this.savePages(filtered);
    return true;
  }

  /**
   * Saves the latest `PageDealStatus` results on disk so the dashboard retains data across restarts even without Postgres.
   */
  saveLatestStatuses(statuses: PageDealStatus[]): void {
    try {
      const existing = this.loadLatestStatuses();
      const deduplicated = deduplicatePageDealStatuses([...existing, ...statuses]);
      fs.writeFileSync(
        this.resultsFilePath,
        JSON.stringify(deduplicated, null, 2) + "\n",
        "utf8",
      );
    } catch {
      // Ignore write failures
    }
  }

  /**
   * Loads the cached `PageDealStatus[]` from disk.
   */
  loadLatestStatuses(): PageDealStatus[] {
    if (!fs.existsSync(this.resultsFilePath)) return [];
    try {
      const parsed = JSON.parse(fs.readFileSync(this.resultsFilePath, "utf8"));
      return Array.isArray(parsed) ? deduplicatePageDealStatuses(parsed) : [];
    } catch {
      return [];
    }
  }

  /**
   * Loads the scraping success rate and execution history log from memory.
   */
  loadHistory(): ScrapeHistoryItem[] {
    return [...this.history];
  }

  /**
   * Saves scraping history in memory.
   */
  saveHistory(history: ScrapeHistoryItem[]): void {
    this.history = history.slice(-60);
  }

  /**
   * Appends a new scrape history item and stores in memory.
   */
  addHistoryItem(item: ScrapeHistoryItem): void {
    this.history.push(item);
    if (this.history.length > 60) {
      this.history = this.history.slice(-60);
    }
  }
}
