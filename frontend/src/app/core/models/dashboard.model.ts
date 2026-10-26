export interface ScrapePageConfig {
  id: string;
  provider: string;
  categoryName: string;
  url: string;
  enabled: boolean;
  withOffers: boolean;
  createdAt: string;
}

export interface SellerOffer {
  sellerName: string;
  price: number;
  cashbackPct: number;
  ratingScore: number;
  ratingCount: number;
  placement: string;
  url: string;
}

export interface RankedDeal {
  category: string;
  title: string;
  url: string;
  region: string;
  sellingPrice: number;
  originalPrice: number | null;
  faceValue: number | null;
  faceValueCurrency?: string | null;
  listedDiscountPct?: number | null;
  cashbackPct: number;
  inStock: boolean;
  discountPct: number;
  effectiveDiscountPct: number;
  effectivePrice: number;
  savingsAmount: number;
  lowestSellerName?: string | null;
  lowestSellerRating?: number | null;
}

export interface PageDealStatus {
  category: string;
  pageUrl: string;
  pageNumber: number;
  scrapedAt: string;
  totalListings: number;
  inStockCount: number;
  outOfStockCount: number;
  discountedCount: number;
  averageDiscountPctOnDiscounted: number;
  averageDiscountPctAllInStock: number;
  averageEffectiveDiscountPct: number;
  maxDiscountPct: number;
  maxEffectiveDiscountPct: number;
  bestDeal: RankedDeal | null;
  bestEffectiveDeal: RankedDeal | null;
  bestDealOffers: SellerOffer[];
  topDeals: RankedDeal[];
  rankedDeals: RankedDeal[];
}

export interface RunnerState {
  isScraping: boolean;
  currentStep: string | null;
  completedPages: number;
  totalPages: number;
  startedAt: string | null;
  lastCompletedAt: string | null;
  lastError: string | null;
  recentLogs: string[];
}

export interface SchedulerState {
  enabled: boolean;
  baseTime: string;
  jitterMinutes: number;
  chosenOffsetMinutes?: number;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastResult?: string | null;
}

export interface EnvFieldSchema {
  key: string;
  label: string;
  group: 'boot' | 'bot' | 'alert' | 'cron' | 'custom';
  storage: 'env' | 'db';
  isSecret?: boolean;
  defaultValue?: string;
  description: string;
  type?: 'text' | 'number' | 'time' | 'url' | 'boolean';
}

export interface ScrapeHistoryItem {
  id?: string;
  timestamp: string;
  totalPages: number;
  successfulPages: number;
  successRate: number; // 0..100 (%)
  totalListings?: number;
  inStockCount?: number;
}

export interface DashboardData {
  pages: ScrapePageConfig[];
  providers: string[];
  statuses: PageDealStatus[];
  runner: RunnerState;
  scheduler: SchedulerState;
  enebaConfig?: Record<string, string>;
  history?: ScrapeHistoryItem[];
  env: {
    schema: Record<string, EnvFieldSchema>;
    values: Record<string, string>;
    envFilePath: string;
  };
}

export type ThemeMode = 'system' | 'light' | 'dark';
