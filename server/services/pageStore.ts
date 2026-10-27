import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PLAYSTATION_GIFT_CARDS_URL } from "../../eneba/playstationGiftCard.js";
import { NINTENDO_GIFT_CARDS_URL } from "../../eneba/nintendoGiftCard.js";
import { ANDROID_GIFT_CARDS_URL } from "../../eneba/androidGiftCard.js";
import { AMAZON_GIFT_CARDS_URL } from "../../eneba/amazonGiftCard.js";
import { APPLE_GIFT_CARDS_URL } from "../../eneba/appleGiftCard.js";
import type { PageDealStatus } from "../../eneba/pageStats.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const DEFAULT_DATA_DIR = path.resolve(REPO_ROOT, "data");

export interface ScrapePageConfig {
  id: string;
  category: string; // e.g. "eneba", "g2a" (scraper provider/category)
  provider?: string; // alias for category
  categoryName?: string; // e.g. "PlayStation (PSN) Gift Cards"
  name?: string; // alias for categoryName
  url: string;
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
  timestamp: string;
  totalPages: number;
  successfulPages: number;
  successRate: number; // 0..100
  totalListings: number;
  inStockCount: number;
  bestDeal?: {
    title: string;
    category: string;
    sellerName: string;
    cost: number;
    faceValue: number;
    discountPct: number;
    url?: string;
  };
}

export const DEFAULT_SCHEDULES: ScheduleConfigItem[] = [
  {
    id: "default",
    name: "Primary Daily Schedule",
    enabled: true,
    baseTime: "19:00",
    jitterMinutes: 60,
    createdAt: "2026-10-25T00:00:00.000Z",
  },
];

export const DEFAULT_SCRAPE_PAGES: ScrapePageConfig[] = [
  {
    id: "a1000000-0000-4000-8000-000000000001",
    category: "eneba",
    provider: "eneba",
    categoryName: "PlayStation (PSN) Gift Cards",
    name: "PlayStation (PSN) Gift Cards",
    url: PLAYSTATION_GIFT_CARDS_URL,
    enabled: true,
    withOffers: true,
    createdAt: "2026-10-25T00:00:00.000Z",
    scheduleId: "default",
  },
  {
    id: "a1000000-0000-4000-8000-000000000005",
    category: "eneba",
    provider: "eneba",
    categoryName: "Nintendo eShop Gift Cards",
    name: "Nintendo eShop Gift Cards",
    url: NINTENDO_GIFT_CARDS_URL,
    enabled: true,
    withOffers: true,
    createdAt: "2026-10-25T00:00:00.000Z",
    scheduleId: "default",
  },
  {
    id: "a1000000-0000-4000-8000-000000000003",
    category: "eneba",
    provider: "eneba",
    categoryName: "Android (Google Play) Gift Cards",
    name: "Android (Google Play) Gift Cards",
    url: ANDROID_GIFT_CARDS_URL,
    enabled: true,
    withOffers: true,
    createdAt: "2026-10-25T00:00:00.000Z",
    scheduleId: "default",
  },
  {
    id: "a1000000-0000-4000-8000-000000000006",
    category: "eneba",
    provider: "eneba",
    categoryName: "Amazon Gift Cards",
    name: "Amazon Gift Cards",
    url: AMAZON_GIFT_CARDS_URL,
    enabled: true,
    withOffers: true,
    createdAt: "2026-10-25T00:00:00.000Z",
    scheduleId: "default",
  },
  {
    id: "a1000000-0000-4000-8000-000000000002",
    category: "eneba",
    provider: "eneba",
    categoryName: "Apple Gift Cards",
    name: "Apple Gift Cards",
    url: APPLE_GIFT_CARDS_URL,
    enabled: true,
    withOffers: true,
    createdAt: "2026-10-25T00:00:00.000Z",
    scheduleId: "default",
  },
];

export class PageStore {
  private readonly pagesFilePath: string;
  private readonly schedulesFilePath: string;
  private readonly resultsFilePath: string;
  private readonly historyFilePath: string;

  constructor(dataDir: string = DEFAULT_DATA_DIR) {
    fs.mkdirSync(dataDir, { recursive: true });
    this.pagesFilePath = path.join(dataDir, "scrape-pages.json");
    this.schedulesFilePath = path.join(dataDir, "schedules.json");
    this.resultsFilePath = path.join(dataDir, "latest-results.json");
    this.historyFilePath = path.join(dataDir, "scrape-history.json");
  }

  /**
   * Lists all configured scraping pages. Initializes with default pages if none exist on disk yet.
   */
  listPages(): ScrapePageConfig[] {
    if (!fs.existsSync(this.pagesFilePath)) {
      this.savePages(DEFAULT_SCRAPE_PAGES);
      return [...DEFAULT_SCRAPE_PAGES];
    }

    try {
      const raw = fs.readFileSync(this.pagesFilePath, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((p) => ({
          ...p,
          scheduleId: p.scheduleId || "default",
        }));
      }
    } catch {
      // Fallback to defaults if corrupted
    }
    this.savePages(DEFAULT_SCRAPE_PAGES);
    return [...DEFAULT_SCRAPE_PAGES];
  }

  savePages(pages: ScrapePageConfig[]): void {
    fs.mkdirSync(path.dirname(this.pagesFilePath), { recursive: true });
    fs.writeFileSync(
      this.pagesFilePath,
      JSON.stringify(pages, null, 2) + "\n",
      "utf8",
    );
  }

  listSchedules(): ScheduleConfigItem[] {
    if (!fs.existsSync(this.schedulesFilePath)) {
      this.saveSchedules(DEFAULT_SCHEDULES);
      return [...DEFAULT_SCHEDULES];
    }
    try {
      const raw = fs.readFileSync(this.schedulesFilePath, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (!parsed.some((s) => s.id === "default")) {
          parsed.unshift(DEFAULT_SCHEDULES[0]);
        }
        return parsed;
      }
    } catch {
      // Fallback
    }
    this.saveSchedules(DEFAULT_SCHEDULES);
    return [...DEFAULT_SCHEDULES];
  }

  saveSchedules(schedules: ScheduleConfigItem[]): void {
    fs.mkdirSync(path.dirname(this.schedulesFilePath), { recursive: true });
    fs.writeFileSync(
      this.schedulesFilePath,
      JSON.stringify(schedules, null, 2) + "\n",
      "utf8",
    );
  }

  getSchedule(id: string): ScheduleConfigItem | undefined {
    return this.listSchedules().find((s) => s.id === id);
  }

  addSchedule(input: {
    name: string;
    baseTime: string;
    jitterMinutes: number;
    enabled?: boolean;
  }): ScheduleConfigItem {
    const list = this.listSchedules();
    const id = `sched-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;
    const item: ScheduleConfigItem = {
      id,
      name: input.name?.trim() || "Custom Schedule",
      baseTime: input.baseTime?.trim() || "19:00",
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
    const idx = list.findIndex((s) => s.id === id);
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
    if (id === "default") return false; // Default cannot be deleted
    const list = this.listSchedules();
    const filtered = list.filter((s) => s.id !== id);
    if (filtered.length === list.length) return false;

    this.saveSchedules(filtered);

    // Reassign any pages that used this schedule back to 'default'
    const pages = this.listPages();
    let pagesChanged = false;
    for (const p of pages) {
      if (p.scheduleId === id) {
        p.scheduleId = "default";
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

    page.scheduleId = scheduleId?.trim() || "default";
    this.savePages(pages);
    return page;
  }

  getAssignedPagesMap(): Record<string, string[]> {
    const map: Record<string, string[]> = {};
    const pages = this.listPages();
    for (const p of pages) {
      const sId = p.scheduleId || "default";
      if (!map[sId]) map[sId] = [];
      map[sId].push(p.id);
    }
    return map;
  }

  /**
   * Adds a new scraping page to the store.
   */
  addPage(input: {
    provider?: string;
    category?: string;
    categoryName?: string;
    name?: string;
    url: string;
    enabled?: boolean;
    withOffers?: boolean;
    scheduleId?: string;
  }): ScrapePageConfig {
    const pages = this.listPages();
    const category = (input.category || input.provider || "eneba").trim().toLowerCase();
    let categoryName = (input.categoryName || input.name || "").trim();
    const url = input.url.trim();

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new Error("A valid full URL (https://...) is required.");
    }

    if (!categoryName) {
      const segments = parsedUrl.pathname.split("/").filter(Boolean);
      categoryName = segments.length > 0 ? segments[segments.length - 1].replace(/[-_]/g, " ") : parsedUrl.hostname;
    }

    const id = crypto.randomUUID();

    const newPage: ScrapePageConfig = {
      id,
      category,
      provider: category,
      categoryName,
      name: categoryName,
      url: parsedUrl.toString(),
      enabled: input.enabled ?? true,
      withOffers: input.withOffers ?? true,
      createdAt: new Date().toISOString(),
      scheduleId: input.scheduleId?.trim() || "default",
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
      patch.categoryName !== undefined
        ? patch.categoryName.trim() || current.categoryName
        : patch.name !== undefined
          ? patch.name.trim() || current.categoryName
          : current.categoryName;

    const updated: ScrapePageConfig = {
      ...current,
      category,
      provider: category,
      categoryName,
      name: categoryName,
      url:
        patch.url !== undefined
          ? new URL(patch.url.trim()).toString()
          : current.url,
      enabled:
        patch.enabled !== undefined ? Boolean(patch.enabled) : current.enabled,
      withOffers:
        patch.withOffers !== undefined
          ? Boolean(patch.withOffers)
          : current.withOffers,
      scheduleId:
        patch.scheduleId !== undefined
          ? patch.scheduleId.trim() || "default"
          : current.scheduleId || "default",
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
      const byCategory = new Map<string, PageDealStatus>();
      for (const st of existing) {
        byCategory.set(st.category, st);
      }
      for (const st of statuses) {
        byCategory.set(st.category, st);
      }
      fs.writeFileSync(
        this.resultsFilePath,
        JSON.stringify(Array.from(byCategory.values()), null, 2) + "\n",
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
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /**
   * Loads the scraping success rate and execution history log from disk.
   */
  loadHistory(): ScrapeHistoryItem[] {
    if (!fs.existsSync(this.historyFilePath)) return [];
    try {
      const parsed = JSON.parse(fs.readFileSync(this.historyFilePath, "utf8"));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /**
   * Saves scraping history on disk.
   */
  saveHistory(history: ScrapeHistoryItem[]): void {
    try {
      const trimmed = history.slice(-60);
      fs.writeFileSync(
        this.historyFilePath,
        JSON.stringify(trimmed, null, 2) + "\n",
        "utf8",
      );
    } catch {
      // Ignore write failures
    }
  }

  /**
   * Appends a new scrape history item and persists to disk.
   */
  addHistoryItem(item: ScrapeHistoryItem): void {
    const list = this.loadHistory();
    list.push(item);
    this.saveHistory(list);
  }
}
