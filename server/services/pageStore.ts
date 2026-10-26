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
  provider: string;
  categoryName: string;
  url: string;
  enabled: boolean;
  withOffers: boolean;
  createdAt: string;
}

export interface ScrapeHistoryItem {
  id: string;
  timestamp: string;
  totalPages: number;
  successfulPages: number;
  successRate: number; // 0..100
  totalListings: number;
  inStockCount: number;
}

export const DEFAULT_SCRAPE_PAGES: ScrapePageConfig[] = [
  {
    id: "eneba-psn",
    provider: "eneba",
    categoryName: "PlayStation (PSN) Gift Cards",
    url: PLAYSTATION_GIFT_CARDS_URL,
    enabled: true,
    withOffers: true,
    createdAt: "2026-10-25T00:00:00.000Z",
  },
  {
    id: "eneba-nintendo",
    provider: "eneba",
    categoryName: "Nintendo eShop Gift Cards",
    url: NINTENDO_GIFT_CARDS_URL,
    enabled: true,
    withOffers: true,
    createdAt: "2026-10-25T00:00:00.000Z",
  },
  {
    id: "eneba-android",
    provider: "eneba",
    categoryName: "Android (Google Play) Gift Cards",
    url: ANDROID_GIFT_CARDS_URL,
    enabled: true,
    withOffers: true,
    createdAt: "2026-10-25T00:00:00.000Z",
  },
  {
    id: "eneba-amazon",
    provider: "eneba",
    categoryName: "Amazon Gift Cards",
    url: AMAZON_GIFT_CARDS_URL,
    enabled: true,
    withOffers: true,
    createdAt: "2026-10-25T00:00:00.000Z",
  },
  {
    id: "eneba-apple",
    provider: "eneba",
    categoryName: "Apple Gift Cards",
    url: APPLE_GIFT_CARDS_URL,
    enabled: true,
    withOffers: true,
    createdAt: "2026-10-25T00:00:00.000Z",
  },
];

export class PageStore {
  private readonly pagesFilePath: string;
  private readonly resultsFilePath: string;
  private readonly historyFilePath: string;

  constructor(dataDir: string = DEFAULT_DATA_DIR) {
    fs.mkdirSync(dataDir, { recursive: true });
    this.pagesFilePath = path.join(dataDir, "scrape-pages.json");
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
        return parsed;
      }
    } catch {
      // Fallback to defaults if corrupted
    }
    this.savePages(DEFAULT_SCRAPE_PAGES);
    return [...DEFAULT_SCRAPE_PAGES];
  }

  private savePages(pages: ScrapePageConfig[]): void {
    fs.mkdirSync(path.dirname(this.pagesFilePath), { recursive: true });
    fs.writeFileSync(
      this.pagesFilePath,
      JSON.stringify(pages, null, 2) + "\n",
      "utf8",
    );
  }

  /**
   * Adds a new scraping page to the store.
   */
  addPage(input: {
    provider?: string;
    categoryName: string;
    url: string;
    enabled?: boolean;
    withOffers?: boolean;
  }): ScrapePageConfig {
    const pages = this.listPages();
    const provider = (input.provider || "eneba").trim().toLowerCase();
    const categoryName = input.categoryName.trim();
    const url = input.url.trim();

    if (!categoryName) {
      throw new Error("Category name is required.");
    }
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new Error("A valid full URL (https://...) is required.");
    }

    const slug = categoryName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 32);
    const id = `${provider}-${slug || crypto.randomBytes(4).toString("hex")}-${Date.now().toString(36).slice(-4)}`;

    const newPage: ScrapePageConfig = {
      id,
      provider,
      categoryName,
      url: parsedUrl.toString(),
      enabled: input.enabled ?? true,
      withOffers: input.withOffers ?? true,
      createdAt: new Date().toISOString(),
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
        "categoryName" | "url" | "provider" | "enabled" | "withOffers"
      >
    >,
  ): ScrapePageConfig | null {
    const pages = this.listPages();
    const idx = pages.findIndex((p) => p.id === id);
    if (idx === -1) return null;

    const current = pages[idx];
    const updated: ScrapePageConfig = {
      ...current,
      categoryName:
        patch.categoryName !== undefined
          ? patch.categoryName.trim() || current.categoryName
          : current.categoryName,
      url:
        patch.url !== undefined
          ? new URL(patch.url.trim()).toString()
          : current.url,
      provider:
        patch.provider !== undefined
          ? patch.provider.trim().toLowerCase() || current.provider
          : current.provider,
      enabled:
        patch.enabled !== undefined ? Boolean(patch.enabled) : current.enabled,
      withOffers:
        patch.withOffers !== undefined
          ? Boolean(patch.withOffers)
          : current.withOffers,
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
