import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  HostListener,
  Inject,
  PLATFORM_ID,
  effect,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import * as echarts from 'echarts';
import { ApiService } from '../../core/services/api.service';
import { ThemeService } from '../../core/services/theme.service';
import type { RankedDeal, ScrapePageConfig, SchedulerState } from '../../core/models/dashboard.model';
import { formatUtcBaseTimeToLocal, isDefaultScheduleId } from '../../core/utils/time.utils';
import { getCanonicalProvider } from '../../core/utils/target.utils';

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  template: `
    <div class="page-container">
      <!-- Page Header -->
      <div class="page-header">
        <div class="header-titles">
          <h1>Overview</h1>
          <p class="subtitle">
            Cross-marketplace gift card discount telemetry, automated schedule health, and historical price trends.
          </p>
        </div>
        <div class="header-actions">
          <button
            mat-stroked-button
            (click)="apiService.loadDashboard(true)"
            [disabled]="apiService.isLoading()"
          >
            <mat-icon>refresh</mat-icon>
            <span>Refresh</span>
          </button>
          <button
            mat-flat-button
            color="primary"
            (click)="triggerAllScrape()"
            [disabled]="apiService.dashboardData()?.runner?.isScraping"
          >
            <mat-icon>play_arrow</mat-icon>
            <span>Scrape All Targets</span>
          </button>
        </div>
      </div>

      <!-- 4 Clean SaaS KPI Cards -->
      <div class="kpi-grid">
        <!-- KPI 1: Best Discount Now -->
        <mat-card class="kpi-card" appearance="outlined">
          <div class="kpi-top">
            <span class="kpi-label">Best Live Discount</span>
            <span class="kpi-icon-box accent-emerald">
              <mat-icon>local_offer</mat-icon>
            </span>
          </div>
          <div class="kpi-metric-row">
            <span class="kpi-value accent-emerald-text">{{ bestGlobalDiscount() }}</span>
            <span class="kpi-pill" *ngIf="topBestDeals.length > 0">
              {{ getProviderLabel(topBestDeals[0].category) }}
            </span>
          </div>
          <div class="kpi-footer-list" *ngIf="topBestDeals.length > 0; else noDealsTpl">
            <a
              *ngFor="let deal of topBestDeals; let i = index"
              [href]="deal.url"
              target="_blank"
              rel="noopener noreferrer"
              class="kpi-deal-row"
            >
              <span class="deal-rank">#{{ i + 1 }}</span>
              <span class="deal-name">{{ deal.title }}</span>
              <span class="deal-price">\${{ deal.sellingPrice.toFixed(2) }}</span>
              <span class="deal-pct">-{{ deal.discountPct.toFixed(1) }}%</span>
            </a>
          </div>
          <ng-template #noDealsTpl>
            <div class="kpi-sub">No active discounted deals yet</div>
          </ng-template>
        </mat-card>

        <!-- KPI 2: Next Scheduled Run -->
        <mat-card class="kpi-card" appearance="outlined">
          <div class="kpi-top">
            <span class="kpi-label">Next Scheduled Run</span>
            <span class="kpi-icon-box accent-blue">
              <mat-icon>schedule</mat-icon>
            </span>
          </div>
          <div class="kpi-metric-row">
            <span class="kpi-value kpi-value-md">{{ nextGlobalRunTime() }}</span>
            <span class="kpi-pill pill-blue" *ngIf="nextGlobalCountdown()">
              {{ nextGlobalCountdown() }}
            </span>
          </div>
          <div class="kpi-sub">{{ nextGlobalWindowSub() }}</div>
          <div class="kpi-links-row">
            <a routerLink="/automation" class="kpi-inline-link">
              <span>Configure schedules</span>
              <mat-icon>arrow_forward</mat-icon>
            </a>
          </div>
        </mat-card>

        <!-- KPI 3: Monitored Marketplaces & Targets -->
        <mat-card class="kpi-card" appearance="outlined">
          <div class="kpi-top">
            <span class="kpi-label">Monitored Targets</span>
            <span class="kpi-icon-box accent-indigo">
              <mat-icon>layers</mat-icon>
            </span>
          </div>
          <div class="kpi-metric-row">
            <span class="kpi-value">{{ enabledPagesCount() }}</span>
            <span class="kpi-unit">/ {{ totalPagesCount() }} active</span>
          </div>
          <div class="kpi-sub">Across {{ activeProviders().length }} gift card marketplaces</div>
          <div class="kpi-chip-row">
            <a routerLink="/eneba" class="provider-chip">
              <span>Eneba</span>
              <span class="chip-count">{{ getProviderTargetCount('eneba') }}</span>
            </a>
            <a routerLink="/g2a" class="provider-chip">
              <span>G2A</span>
              <span class="chip-count">{{ getProviderTargetCount('g2a') }}</span>
            </a>
          </div>
        </mat-card>

        <!-- KPI 4: Active Inventory -->
        <mat-card class="kpi-card" appearance="outlined">
          <div class="kpi-top">
            <span class="kpi-label">In-Stock Listings</span>
            <span class="kpi-icon-box accent-amber">
              <mat-icon>inventory_2</mat-icon>
            </span>
          </div>
          <div class="kpi-metric-row">
            <span class="kpi-value">{{ totalInStock() }}</span>
            <span class="kpi-pill pill-emerald" *ngIf="totalDiscounted() > 0">
              {{ totalDiscounted() }} discounted
            </span>
          </div>
          <div class="kpi-sub">
            Peak historical discount: <strong>{{ peakDiscountPct() }}</strong>
          </div>
          <div class="kpi-links-row">
            <a routerLink="/eneba" class="kpi-inline-link">
              <span>Browse top deals</span>
              <mat-icon>arrow_forward</mat-icon>
            </a>
          </div>
        </mat-card>
      </div>

      <!-- Marketplace Quick Access Strip -->
      <div class="marketplace-strip">
        <a routerLink="/eneba" class="marketplace-card">
          <div class="mp-left">
            <div class="mp-icon mp-eneba">
              <mat-icon>local_offer</mat-icon>
            </div>
            <div class="mp-info">
              <div class="mp-title-row">
                <span class="mp-name">Eneba Marketplace</span>
                <span class="mp-badge">{{ getProviderTargetCount('eneba') }} targets</span>
              </div>
              <span class="mp-desc">
                PSN, Nintendo eShop, Google Play, Apple, Amazon &amp; Steam gift cards
              </span>
            </div>
          </div>
          <div class="mp-right">
            <div class="mp-stat">
              <span class="mp-stat-label">Best Discount</span>
              <span class="mp-stat-val">{{ getProviderBestDiscount('eneba') }}</span>
            </div>
            <mat-icon class="mp-arrow">chevron_right</mat-icon>
          </div>
        </a>

        <a routerLink="/g2a" class="marketplace-card">
          <div class="mp-left">
            <div class="mp-icon mp-g2a">
              <mat-icon>sports_esports</mat-icon>
            </div>
            <div class="mp-info">
              <div class="mp-title-row">
                <span class="mp-name">G2A Marketplace</span>
                <span class="mp-badge">{{ getProviderTargetCount('g2a') }} targets</span>
              </div>
              <span class="mp-desc">
                Google Play &amp; PlayStation Network digital gift card codes
              </span>
            </div>
          </div>
          <div class="mp-right">
            <div class="mp-stat">
              <span class="mp-stat-label">Best Discount</span>
              <span class="mp-stat-val">{{ getProviderBestDiscount('g2a') }}</span>
            </div>
            <mat-icon class="mp-arrow">chevron_right</mat-icon>
          </div>
        </a>
      </div>

      <!-- Analytical Charts Row -->
      <div class="charts-grid">
        <!-- Scrape Success Rate Chart -->
        <mat-card class="main-card" appearance="outlined">
          <mat-card-header class="table-header">
            <div>
              <mat-card-title>Scrape Reliability</mat-card-title>
              <mat-card-subtitle>
                Percentage of enabled targets returning valid listings per batch run.
              </mat-card-subtitle>
            </div>
            <div class="metric-badge" *ngIf="!isLoading">
              <span class="metric-badge-label">Avg</span>
              <strong class="metric-badge-val">{{ averageSuccessRate() }}%</strong>
            </div>
          </mat-card-header>
          <mat-card-content class="chart-card-content chart-wrapper-relative">
            <div *ngIf="isLoading" class="ui-loading-overlay">
              <mat-spinner diameter="32" strokeWidth="3"></mat-spinner>
              <span class="loading-label">Loading reliability metrics...</span>
            </div>

            <div *ngIf="!isLoading && hasNoHistory" class="empty-chart">
              <mat-icon class="empty-icon">bar_chart</mat-icon>
              <p>No scrape runs recorded yet.</p>
            </div>

            <div
              #successChartContainer
              class="echarts-container"
              style="height: 290px; width: 100%;"
              [style.visibility]="!isLoading && !hasNoHistory ? 'visible' : 'hidden'"
            ></div>
          </mat-card-content>
        </mat-card>

        <!-- Best Discount in History Chart -->
        <mat-card class="main-card" appearance="outlined">
          <mat-card-header class="table-header">
            <div>
              <mat-card-title>Best Discount History</mat-card-title>
              <mat-card-subtitle>
                Peak gift card discount percentage captured across historical scrape runs.
              </mat-card-subtitle>
            </div>
            <div class="metric-badge" *ngIf="!isLoading">
              <span class="metric-badge-label">Peak</span>
              <strong class="metric-badge-val accent-emerald-text">{{ peakDiscountPct() }}</strong>
            </div>
          </mat-card-header>
          <mat-card-content class="chart-card-content chart-wrapper-relative">
            <div *ngIf="isLoading" class="ui-loading-overlay">
              <mat-spinner diameter="32" strokeWidth="3"></mat-spinner>
              <span class="loading-label">Loading discount history...</span>
            </div>

            <div *ngIf="!isLoading && hasNoBestDealHistory" class="empty-chart">
              <mat-icon class="empty-icon">trending_up</mat-icon>
              <p>No historical discount deals recorded yet.</p>
            </div>

            <div
              #bestDiscountChartContainer
              class="echarts-container"
              style="height: 290px; width: 100%;"
              [style.visibility]="!isLoading && !hasNoBestDealHistory ? 'visible' : 'hidden'"
            ></div>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styleUrl: './overview.component.scss',
})
export class OverviewComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('successChartContainer') successChartContainerRef?: ElementRef<HTMLDivElement>;
  @ViewChild('bestDiscountChartContainer') bestDiscountChartContainerRef?: ElementRef<HTMLDivElement>;

  private successChart?: echarts.ECharts;
  private bestDiscountChart?: echarts.ECharts;
  private resizeObserver?: ResizeObserver;

  constructor(
    public apiService: ApiService,
    private snackBar: MatSnackBar,
    private themeService: ThemeService,
    @Inject(PLATFORM_ID) private platformId: object,
  ) {
    effect(() => {
      const data = this.apiService.dashboardData();
      const _theme = this.themeService.themeMode();
      if (data && isPlatformBrowser(this.platformId)) {
        setTimeout(() => this.renderAllCharts(), 0);
      }
    });
  }

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.renderAllCharts();
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.successChart?.dispose();
    this.bestDiscountChart?.dispose();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.successChart?.resize();
    this.bestDiscountChart?.resize();
  }

  get isLoading(): boolean {
    return this.apiService.isLoading() || !this.apiService.dashboardData();
  }

  get hasNoHistory(): boolean {
    const data = this.apiService.dashboardData();
    if (!data) return true;
    return !(data.history?.length || data.statuses?.length);
  }

  get hasNoBestDealHistory(): boolean {
    const data = this.apiService.dashboardData();
    if (!data) return true;
    const hasHist = (data.history || []).some((h) => h.bestDeal && h.bestDeal.discountPct > 0);
    const hasStat = (data.statuses || []).some(
      (s) => s.bestDeal || s.bestEffectiveDeal || (s.rankedDeals && s.rankedDeals.length > 0),
    );
    return !hasHist && !hasStat;
  }

  activeProviders(): string[] {
    const pages = this.apiService.dashboardData()?.pages || [];
    const set = new Set<string>(['eneba', 'g2a']);
    for (const p of pages) {
      const prov = p.provider || p.category;
      if (prov) {
        set.add(prov.toLowerCase());
      }
    }
    return Array.from(set);
  }

  getProviderLabel(prov?: string): string {
    const p = (prov || '').toLowerCase();
    if (p.includes('g2a')) return 'G2A';
    return 'Eneba';
  }

  getProviderTargetCount(provider: string): number {
    const pages = this.apiService.dashboardData()?.pages || [];
    return pages.filter(
      (p) => (p.provider || p.category || 'eneba').toLowerCase() === provider.toLowerCase() && p.enabled,
    ).length;
  }

  getProviderBestDiscount(provider: string): string {
    const statuses = this.apiService.dashboardData()?.statuses || [];
    let max = 0;
    for (const s of statuses) {
      if (getCanonicalProvider(s) !== provider.toLowerCase()) continue;
      const d = s.bestDeal?.discountPct || s.maxDiscountPct || 0;
      if (d > max) max = d;
    }
    return max > 0 ? `-${max.toFixed(1)}%` : '—';
  }

  totalPagesCount(): number {
    return this.apiService.dashboardData()?.pages?.length || 0;
  }

  enabledPagesCount(): number {
    return (this.apiService.dashboardData()?.pages || []).filter((p) => p.enabled).length;
  }

  totalInStock(): number {
    return (this.apiService.dashboardData()?.statuses || []).reduce(
      (acc, s) => acc + (s.inStockCount || 0),
      0,
    );
  }

  totalDiscounted(): number {
    return (this.apiService.dashboardData()?.statuses || []).reduce(
      (acc, s) => acc + (s.discountedCount || 0),
      0,
    );
  }

  get topBestDeals(): RankedDeal[] {
    const statuses = this.apiService.dashboardData()?.statuses || [];
    const candidates: RankedDeal[] = [];
    const seen = new Set<string>();

    for (const s of statuses) {
      const prov = getCanonicalProvider(s);
      const list = [s.bestDeal, s.bestEffectiveDeal, ...(s.rankedDeals || [])];
      for (const item of list) {
        if (!item || item.discountPct <= 0) continue;
        const key = (item.url || item.title).toLowerCase().trim();
        if (seen.has(key)) continue;
        seen.add(key);
        candidates.push({ ...item, category: prov });
      }
    }

    candidates.sort((a, b) => b.discountPct - a.discountPct);
    return candidates.slice(0, 2);
  }

  bestGlobalDiscount(): string {
    const top = this.topBestDeals;
    if (top.length > 0 && top[0].discountPct > 0) {
      return `-${top[0].discountPct.toFixed(1)}%`;
    }
    return '—';
  }

  private getEarliestSchedule(): SchedulerState | undefined {
    const data = this.apiService.dashboardData();
    if (!data) return undefined;
    const list =
      data.schedulers && data.schedulers.length > 0
        ? data.schedulers
        : data.scheduler
          ? [data.scheduler]
          : [];
    const enabled = list.filter((s) => s.enabled && s.nextRunAt && !isNaN(new Date(s.nextRunAt).getTime()));
    if (enabled.length === 0) return list[0];
    return enabled.sort(
      (a, b) => new Date(a.nextRunAt!).getTime() - new Date(b.nextRunAt!).getTime(),
    )[0];
  }

  nextGlobalRunTime(): string {
    const sched = this.getEarliestSchedule();
    if (!sched || !sched.enabled) return 'Paused';
    if (!sched.nextRunAt) return 'Pending';
    const d = new Date(sched.nextRunAt);
    if (isNaN(d.getTime())) return 'Pending';

    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const tmrw = new Date(now);
    tmrw.setDate(tmrw.getDate() + 1);
    const isTomorrow = d.toDateString() === tmrw.toDateString();
    const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

    if (isToday) return `Today, ${timeStr}`;
    if (isTomorrow) return `Tomorrow, ${timeStr}`;
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
  }

  nextGlobalCountdown(): string {
    const sched = this.getEarliestSchedule();
    if (!sched?.enabled || !sched?.nextRunAt) return '';
    const diffMs = new Date(sched.nextRunAt).getTime() - Date.now();
    if (diffMs <= 0) return 'Soon';
    const mins = Math.floor(diffMs / 60000);
    const hours = Math.floor(mins / 60);
    if (hours > 0) return `in ${hours}h ${mins % 60}m`;
    return `in ${mins}m`;
  }

  nextGlobalWindowSub(): string {
    const sched = this.getEarliestSchedule();
    if (!sched) return 'No active schedules';
    const localBase = formatUtcBaseTimeToLocal(sched.baseTime, this.apiService.getTimeZone());
    return `${sched.name || 'Primary Schedule'} · Base ${localBase} (+0..${sched.jitterMinutes}m)`;
  }

  averageSuccessRate(): string {
    const history = this.apiService.dashboardData()?.history || [];
    if (history.length === 0) return '100';
    const sum = history.reduce((acc, h) => acc + (h.successRate ?? 100), 0);
    return (sum / history.length).toFixed(1);
  }

  peakDiscountPct(): string {
    const data = this.apiService.dashboardData();
    const history = data?.history || [];
    const statuses = data?.statuses || [];
    let maxPct = 0;

    for (const h of history) {
      if (h.bestDeal && h.bestDeal.discountPct > maxPct) {
        maxPct = h.bestDeal.discountPct;
      }
    }
    for (const s of statuses) {
      const d = s.bestDeal || s.bestEffectiveDeal;
      if (d && d.discountPct > maxPct) {
        maxPct = d.discountPct;
      }
    }
    return maxPct > 0 ? `-${maxPct.toFixed(1)}%` : '—';
  }

  triggerAllScrape(): void {
    this.apiService.triggerScrape({}).subscribe(() => {
      this.snackBar.open('Triggered scrape across all enabled targets', 'OK', { duration: 3000 });
    });
  }

  private isDarkTheme(): boolean {
    const mode = this.themeService.themeMode();
    return (
      mode === 'dark' ||
      (mode === 'system' &&
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches)
    );
  }

  private renderAllCharts(): void {
    this.renderSuccessChart();
    this.renderBestDiscountChart();
  }

  private renderSuccessChart(): void {
    const el = this.successChartContainerRef?.nativeElement;
    if (!el) return;

    const data = this.apiService.dashboardData();
    let history = [...(data?.history || [])];
    if (history.length === 0) return;

    history.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    if (!this.successChart) {
      this.successChart = echarts.init(el);
    }

    const isDark = this.isDarkTheme();
    const labels = history.map((h) => {
      const d = new Date(h.timestamp);
      return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    });
    const values = history.map((h) => Number((h.successRate ?? 100).toFixed(1)));

    this.successChart.setOption({
      backgroundColor: 'transparent',
      grid: { top: 20, right: 16, bottom: 26, left: 42 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: isDark ? '#18181b' : '#ffffff',
        borderColor: isDark ? '#27272a' : '#e4e4e7',
        textStyle: { color: isDark ? '#f4f4f5' : '#18181b', fontSize: 12 },
      },
      xAxis: {
        type: 'category',
        data: labels,
        axisLine: { lineStyle: { color: isDark ? '#27272a' : '#e4e4e7' } },
        axisLabel: { color: isDark ? '#a1a1aa' : '#71717a', fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 100,
        axisLabel: { formatter: '{value}%', color: isDark ? '#a1a1aa' : '#71717a', fontSize: 11 },
        splitLine: { lineStyle: { color: isDark ? '#27272a' : '#f4f4f5', type: 'dashed' } },
      },
      series: [
        {
          name: 'Success Rate',
          type: 'line',
          smooth: true,
          symbolSize: 6,
          data: values,
          itemStyle: { color: '#3b82f6' },
          lineStyle: { width: 2, color: '#3b82f6' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(59, 130, 246, 0.20)' },
              { offset: 1, color: 'rgba(59, 130, 246, 0.0)' },
            ]),
          },
        },
      ],
    });
  }

  private renderBestDiscountChart(): void {
    const el = this.bestDiscountChartContainerRef?.nativeElement;
    if (!el) return;

    const data = this.apiService.dashboardData();
    const history = (data?.history || []).filter((h) => h.bestDeal && h.bestDeal.discountPct > 0);
    if (history.length === 0) return;

    const sorted = [...history].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    if (!this.bestDiscountChart) {
      this.bestDiscountChart = echarts.init(el);
    }

    const isDark = this.isDarkTheme();
    const labels = sorted.map((h) => {
      const d = new Date(h.timestamp);
      return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    });
    const values = sorted.map((h) => Number((h.bestDeal?.discountPct || 0).toFixed(1)));

    this.bestDiscountChart.setOption({
      backgroundColor: 'transparent',
      grid: { top: 20, right: 16, bottom: 26, left: 42 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: isDark ? '#18181b' : '#ffffff',
        borderColor: isDark ? '#27272a' : '#e4e4e7',
        textStyle: { color: isDark ? '#f4f4f5' : '#18181b', fontSize: 12 },
        formatter: (params: any) => {
          const idx = params?.[0]?.dataIndex ?? 0;
          const item = sorted[idx];
          const deal = item?.bestDeal;
          if (!deal) return '';
          return `
            <div style="font-weight:600;margin-bottom:4px;">${deal.title}</div>
            <div>Discount: <strong style="color:#10b981;">-${deal.discountPct.toFixed(1)}%</strong></div>
            <div>Price: <strong>$${(deal.cost || 0).toFixed(2)}</strong> (Face $${(deal.faceValue || 0).toFixed(2)})</div>
            <div style="opacity:0.75;font-size:11px;margin-top:2px;">Seller: ${deal.sellerName || 'Top Merchant'}</div>
          `;
        },
      },
      xAxis: {
        type: 'category',
        data: labels,
        axisLine: { lineStyle: { color: isDark ? '#27272a' : '#e4e4e7' } },
        axisLabel: { color: isDark ? '#a1a1aa' : '#71717a', fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        axisLabel: { formatter: '{value}%', color: isDark ? '#a1a1aa' : '#71717a', fontSize: 11 },
        splitLine: { lineStyle: { color: isDark ? '#27272a' : '#f4f4f5', type: 'dashed' } },
      },
      series: [
        {
          name: 'Best Discount',
          type: 'line',
          smooth: true,
          symbolSize: 6,
          data: values,
          itemStyle: { color: '#10b981' },
          lineStyle: { width: 2, color: '#10b981' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(16, 185, 129, 0.20)' },
              { offset: 1, color: 'rgba(16, 185, 129, 0.0)' },
            ]),
          },
        },
      ],
    });
  }
}
