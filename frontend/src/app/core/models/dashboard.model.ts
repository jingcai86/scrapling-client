export interface ScrapePageConfig {
  id: string;
  productId?: string | null;
  productSlug?: string | null;
  productTitle?: string | null;
  category?: string;
  provider: string;
  categoryName?: string;
  name?: string;
  url: string;
  enabled: boolean;
  withOffers?: boolean;
  createdAt: string;
  scheduleId?: string;
}

export interface CatalogProduct {
  id: string;
  slug: string;
  title: string;
  url: string | null;
  provider: string | null;
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
  scrapeTargetId?: string;
  targetId?: string;
  targetName?: string;
  name?: string;
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

export interface FaceValueStatItem {
  faceValue: number;
  title?: string;
  url?: string;
  currency?: string;
  discountPct: number;
  sellingPrice: number;
  savingsAmount: number;
}

export interface TargetFaceValueAnalytics {
  mostFrequentFace?: {
    faceValue: number;
    title?: string;
    url?: string;
    currency?: string;
    timesDiscounted: number;
    avgDiscountPct: number;
  };
  peakDiscountFace?: {
    faceValue: number;
    title?: string;
    url?: string;
    currency?: string;
    maxDiscountPct: number;
    minPrice: number;
    savingsAmount?: number;
  };
  faceValues?: FaceValueStatItem[];
}

export interface TargetScrapeRunLog {
  batchId: string;
  runTime: string;
  itemsCount: number;
  inStockCount: number;
  status: 'success' | 'warning' | 'error';
  durationMs?: number;
}

export interface PageDealStatus {
  category: string;
  provider?: string;
  scrapeTargetId?: string;
  targetId?: string;
  targetName?: string;
  name?: string;
  pageUrl: string;
  pageNumber: number;
  scrapedAt: string;
  totalListings: number;
  inStockCount: number;
  outOfStockCount: number;
  discountedCount: number;
  scrapeCount?: number;
  runStatus?: 'success' | 'warning' | 'error' | 'idle';
  faceAnalytics?: TargetFaceValueAnalytics;
  recentRuns?: TargetScrapeRunLog[];
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
  id?: string;
  name?: string;
  enabled: boolean;
  baseTime: string;
  jitterMinutes: number;
  chosenOffsetMinutes?: number;
  chosenOffsetSeconds?: number;
  windowStartIso?: string | null;
  windowEndIso?: string | null;
  nextRunAt: string | null;
  isRunningJob?: boolean;
  lastRunAt: string | null;
  lastRunStatus?: 'idle' | 'running' | 'success' | 'error';
  lastRunSummary?: string | null;
  lastResult?: string | null;
  assignedPageIds?: string[];
}

export interface ScheduleItemConfig {
  id: string;
  name: string;
  enabled: boolean;
  baseTime: string;
  jitterMinutes: number;
  createdAt?: string;
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
  provider?: string;
  timestamp: string;
  totalPages: number;
  successfulPages: number;
  successRate: number; // 0..100 (%)
  totalListings?: number;
  inStockCount?: number;
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

export interface DashboardData {
  pages: ScrapePageConfig[];
  providers: string[];
  statuses: PageDealStatus[];
  runner: RunnerState;
  scheduler: SchedulerState;
  schedulers?: SchedulerState[];
  enebaConfig?: Record<string, string>;
  history?: ScrapeHistoryItem[];
  env: {
    schema: Record<string, EnvFieldSchema>;
    values: Record<string, string>;
    envFilePath: string;
  };
}

export type ThemeMode = 'system' | 'light' | 'dark';

export const CANONICAL_TARGET_URLS: Record<string, string> = {
  'a1000000-0000-4000-8000-000000000001': 'https://www.eneba.com/us/store/psn-gift-cards',
  'a1000000-0000-4000-8000-000000000002': 'https://www.eneba.com/us/store/apple-gift-cards',
  'a1000000-0000-4000-8000-000000000003': 'https://www.eneba.com/us/store/google-play-gift-cards',
  'a1000000-0000-4000-8000-000000000004': 'https://www.eneba.com/store/gift-cards?regions[]=united_states&types[]=gift_card&platforms[]=steam',
  'a1000000-0000-4000-8000-000000000005': 'https://www.eneba.com/us/store/nintendo-gift-cards',
  'a1000000-0000-4000-8000-000000000006': 'https://www.eneba.com/us/store/amazon-gift-cards',
  'a1000000-0000-4000-8000-000000000008': 'https://www.g2a.com/search?query=google%20play',
  'a1000000-0000-4000-8000-000000000009': 'https://www.g2a.com/category/psn-c1567',
};

export const CANONICAL_CATEGORY_URLS: Record<string, string> = {
  'eneba:psn': 'https://www.eneba.com/us/store/psn-gift-cards',
  'eneba:apple': 'https://www.eneba.com/us/store/apple-gift-cards',
  'eneba:google-play': 'https://www.eneba.com/us/store/google-play-gift-cards',
  'eneba:steam': 'https://www.eneba.com/store/gift-cards?regions[]=united_states&types[]=gift_card&platforms[]=steam',
  'eneba:nintendo': 'https://www.eneba.com/us/store/nintendo-gift-cards',
  'eneba:amazon': 'https://www.eneba.com/us/store/amazon-gift-cards',
  'g2a:google-play': 'https://www.g2a.com/search?query=google%20play',
  'g2a:psn': 'https://www.g2a.com/category/psn-c1567',
};
