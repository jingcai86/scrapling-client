import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
  HostListener,
  DoCheck,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import * as echarts from 'echarts';
import { ApiService } from '../../core/services/api.service';
import { ThemeService } from '../../core/services/theme.service';
import type { ScrapeHistoryItem, SchedulerState } from '../../core/models/dashboard.model';

interface ProviderRow {
  provider: string;
  activePages: number;
  status: string;
  lastScraped: string;
  lastScrapedRaw?: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatTableModule,
    MatSortModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="page-container">
      <!-- High Level KPI Cards -->
      <div class="kpi-grid">
        <mat-card class="kpi-card kpi-indigo" appearance="outlined">
          <div class="kpi-top-bar"></div>
          <div class="kpi-card-inner">
            <div class="kpi-header-row">
              <span class="kpi-eyebrow">Monitored Providers</span>
              <div class="kpi-icon-pill">
                <mat-icon>storefront</mat-icon>
              </div>
            </div>
            <div class="kpi-value-row">
              <span class="kpi-metric-num">{{ providersCount() }}</span>
              <span class="kpi-unit-badge">active engines</span>
            </div>
            <div class="kpi-sub-row">
              <span class="kpi-highlight-pill">
                <mat-icon class="pill-icon">layers</mat-icon>
                <strong>{{ pagesCount() }}</strong> active scrape pages
              </span>
            </div>
          </div>
        </mat-card>

        <mat-card class="kpi-card kpi-cyan" appearance="outlined">
          <div class="kpi-top-bar"></div>
          <div class="kpi-card-inner">
            <div class="kpi-header-row">
              <span class="kpi-eyebrow">Last Global Scrape</span>
              <div class="kpi-icon-pill">
                <mat-icon>update</mat-icon>
              </div>
            </div>
            <div class="kpi-value-row">
              <span class="kpi-metric-num kpi-time-text">{{ lastScrapedTime() }}</span>
            </div>
            <div class="kpi-sub-row">
              <span class="kpi-sub-muted">Across all configured categories</span>
            </div>
          </div>
        </mat-card>

        <mat-card class="kpi-card kpi-purple" appearance="outlined">
          <div class="kpi-top-bar"></div>
          <div class="kpi-card-inner">
            <div class="kpi-header-row">
              <span class="kpi-eyebrow">Next Scheduled Scrape</span>
              <div class="kpi-icon-pill">
                <mat-icon>alarm</mat-icon>
              </div>
            </div>
            <div class="kpi-value-row">
              <span class="kpi-metric-num kpi-cron-text">{{ nextCronTime() }}</span>
            </div>
            <div class="kpi-sub-row">
              <span class="kpi-sub-muted">{{ cronWindow() }}</span>
            </div>
          </div>
        </mat-card>

        <mat-card class="kpi-card kpi-emerald" appearance="outlined">
          <div class="kpi-top-bar"></div>
          <div class="kpi-card-inner">
            <div class="kpi-header-row">
              <span class="kpi-eyebrow">Avg Scraping Success</span>
              <div class="kpi-icon-pill">
                <mat-icon>insights</mat-icon>
              </div>
            </div>
            <div class="kpi-value-row">
              <span class="kpi-metric-num" [class.kpi-deal-pct]="avgSuccessRateNum >= 80">{{ avgSuccessRate }}</span>
              <span class="kpi-unit-badge kpi-unit-emerald">reliability</span>
            </div>
            <div class="kpi-sub-row">
              <span class="kpi-sub-muted">Extraction health across runs</span>
            </div>
          </div>
        </mat-card>
      </div>

      <!-- Charts Section: Success Rate & Results Extracted Over Time (Side by Side) -->
      <div class="charts-grid">
        <!-- Chart 1: Scraping Success Rate Over Time (Apache ECharts) -->
        <mat-card class="main-card chart-card" appearance="outlined">
          <mat-card-header class="chart-header">
            <mat-card-title class="chart-title">Scraping Success Rate</mat-card-title>
            <mat-card-subtitle>
              Real-time trend line of page extraction success rate (0% – 100%).
            </mat-card-subtitle>
            <div class="chart-kpis" *ngIf="historyItems.length > 0">
              <div class="stat-pill">
                <span class="stat-label">Avg:</span>
                <span class="stat-val" [class.success]="avgSuccessRateNum >= 80">{{ avgSuccessRate }}</span>
              </div>
              <div class="stat-pill">
                <span class="stat-label">Runs:</span>
                <span class="stat-val">{{ historyItems.length }}</span>
              </div>
            </div>
          </mat-card-header>

          <mat-card-content class="chart-content chart-wrapper-relative">
            <!-- Loading State Overlay -->
            <div *ngIf="isLoading" class="ui-loading-overlay">
              <mat-spinner diameter="38" strokeWidth="3"></mat-spinner>
              <span class="loading-label">Loading scraping success trends...</span>
            </div>

            <!-- Empty State -->
            <div *ngIf="!isLoading && historyItems.length === 0" class="empty-chart">
              <mat-icon class="empty-icon">show_chart</mat-icon>
              <p>No scraping history recorded yet.</p>
            </div>

            <!-- Chart Container (always mounted with accurate dimensions) -->
            <div
              #chartContainer
              class="echarts-container"
              [style.visibility]="!isLoading && historyItems.length > 0 ? 'visible' : 'hidden'"
            ></div>
          </mat-card-content>
        </mat-card>

        <!-- Chart 2: Number of Results Extracted Over Time (Apache ECharts) -->
        <mat-card class="main-card chart-card" appearance="outlined">
          <mat-card-header class="chart-header">
            <mat-card-title class="chart-title">Scraped Results Over Time</mat-card-title>
            <mat-card-subtitle>
              Number of gift card deal results extracted per scrape run.
            </mat-card-subtitle>
            <div class="chart-kpis" *ngIf="historyItems.length > 0">
              <div class="stat-pill">
                <span class="stat-label">Latest:</span>
                <span class="stat-val highlight">{{ latestResultsCount }} items</span>
              </div>
              <div class="stat-pill">
                <span class="stat-label">Total Extracted:</span>
                <span class="stat-val">{{ totalExtractedResults }}</span>
              </div>
            </div>
          </mat-card-header>

          <mat-card-content class="chart-content chart-wrapper-relative">
            <!-- Loading State Overlay -->
            <div *ngIf="isLoading" class="ui-loading-overlay">
              <mat-spinner diameter="38" strokeWidth="3"></mat-spinner>
              <span class="loading-label">Loading extracted results history...</span>
            </div>

            <!-- Empty State -->
            <div *ngIf="!isLoading && historyItems.length === 0" class="empty-chart">
              <mat-icon class="empty-icon">bar_chart</mat-icon>
              <p>No extraction results recorded yet.</p>
            </div>

            <!-- Chart Container (always mounted with accurate dimensions) -->
            <div
              #resultsChartContainer
              class="echarts-container"
              [style.visibility]="!isLoading && historyItems.length > 0 ? 'visible' : 'hidden'"
            ></div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Provider Overview Table -->
      <mat-card class="main-card" appearance="outlined">
        <mat-card-header class="table-header">
          <mat-card-title>Store Provider History &amp; Details</mat-card-title>
          <mat-card-subtitle>
            Overview of configured store providers and scraping history. Click a provider row to view detailed deals and category metrics.
          </mat-card-subtitle>
          <div class="table-actions">
            <a mat-stroked-button routerLink="/schedulers" class="action-btn">
              <mat-icon>schedule</mat-icon>
              <span>Job Scheduler &amp; Targets</span>
            </a>
          </div>
        </mat-card-header>
        <mat-card-content class="card-table-content table-wrapper-relative">
          <!-- Loading State Overlay -->
          <div *ngIf="isLoading" class="ui-loading-overlay">
            <mat-spinner diameter="36" strokeWidth="3"></mat-spinner>
            <span class="loading-label">Loading store provider metrics...</span>
          </div>

          <div class="table-wrapper" [class.table-loading-dimmed]="isLoading">
            <table mat-table [dataSource]="sortedProviders" matSort (matSortChange)="sortProviders($event)" class="data-table">
              <ng-container matColumnDef="provider">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Provider</th>
                <td mat-cell *matCellDef="let p">
                  <span class="badge badge-provider">{{ p.provider | uppercase }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="activePages">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Tracked Pages</th>
                <td mat-cell *matCellDef="let p">
                  <strong>{{ p.activePages }}</strong> pages enabled
                </td>
              </ng-container>

              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Status</th>
                <td mat-cell *matCellDef="let p">
                  <span class="badge" [ngClass]="p.status === 'Active' ? 'badge-discount' : 'badge-muted'">
                    ● {{ p.status }}
                  </span>
                </td>
              </ng-container>

              <ng-container matColumnDef="lastScraped">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Last Scraped</th>
                <td mat-cell *matCellDef="let p" class="scraped-date">{{ p.lastScraped }}</td>
              </ng-container>

              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef>Provider Details</th>
                <td mat-cell *matCellDef="let p">
                  <a mat-stroked-button color="primary" [routerLink]="['/' + p.provider]" class="btn-xs action-link" (click)="$event.stopPropagation()">
                    <span>{{ p.provider === 'eneba' ? 'Eneba Provider Details' : (p.provider | titlecase) + ' Provider Details' }} →</span>
                  </a>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns;" class="clickable-row" [routerLink]="['/' + row.provider]"></tr>
            </table>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styleUrl: './home.component.scss',
})
export class HomeComponent implements AfterViewInit, OnDestroy, DoCheck {
  displayedColumns: string[] = ['provider', 'activePages', 'status', 'lastScraped', 'actions'];
  sortedProviders: ProviderRow[] = [];

  @ViewChild('chartContainer') chartContainerRef?: ElementRef<HTMLDivElement>;
  @ViewChild('resultsChartContainer') resultsChartContainerRef?: ElementRef<HTMLDivElement>;
  private chartInstance?: echarts.ECharts;
  private resultsChartInstance?: echarts.ECharts;
  private resizeObserver?: ResizeObserver;
  private resultsResizeObserver?: ResizeObserver;
  private lastRenderedTheme?: string;
  private lastItemsCount = -1;
  private lastDataRef?: any;

  constructor(
    private apiService: ApiService,
    private themeService: ThemeService,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: object,
  ) {}

  get historyItems(): ScrapeHistoryItem[] {
    const history = this.apiService.dashboardData()?.history;
    if (history && history.length > 0) return history;
    const statuses = this.apiService.dashboardData()?.statuses || [];
    if (statuses.length > 0) {
      const successful = statuses.filter((s) => s.totalListings > 0).length;
      return [
        {
          timestamp: statuses[0].scrapedAt,
          totalPages: statuses.length,
          successfulPages: successful,
          successRate: Number(((successful / statuses.length) * 100).toFixed(1)),
          totalListings: statuses.reduce((acc, s) => acc + (s.totalListings || 0), 0),
          inStockCount: statuses.reduce((acc, s) => acc + (s.inStockCount || 0), 0),
        },
      ];
    }
    return [];
  }

  get latestResultsCount(): number {
    const items = this.historyItems;
    if (!items.length) return 0;
    return items[items.length - 1].totalListings ?? 0;
  }

  get totalExtractedResults(): number {
    return this.historyItems.reduce((acc, i) => acc + (i.totalListings ?? 0), 0);
  }

  get avgSuccessRateNum(): number {
    const items = this.historyItems;
    if (!items.length) return 100;
    const sum = items.reduce((acc, i) => acc + i.successRate, 0);
    return Number((sum / items.length).toFixed(1));
  }

  get avgSuccessRate(): string {
    return `${this.avgSuccessRateNum}%`;
  }

  get isLoading(): boolean {
    return this.apiService.isLoading() || !this.apiService.dashboardData();
  }

  ngAfterViewInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.initOrUpdateCharts();
      this.triggerAllChartsResize();
    }
  }

  ngDoCheck() {
    const data = this.apiService.dashboardData();
    if (data !== this.lastDataRef) {
      this.lastDataRef = data;
      this.updateProvidersList();
      this.cdr.markForCheck();
      if (isPlatformBrowser(this.platformId)) {
        setTimeout(() => {
          this.initOrUpdateCharts();
          this.triggerAllChartsResize();
          this.cdr.markForCheck();
        }, 0);
      }
    }
    if (isPlatformBrowser(this.platformId)) {
      const currentTheme = this.themeService.themeMode();
      const currentCount = this.historyItems.length;
      if (currentTheme !== this.lastRenderedTheme || currentCount !== this.lastItemsCount) {
        setTimeout(() => {
          this.initOrUpdateCharts();
          this.triggerAllChartsResize();
          this.cdr.markForCheck();
        }, 0);
      }
    }
  }

  ngOnDestroy() {
    this.resizeObserver?.disconnect();
    this.resultsResizeObserver?.disconnect();
    this.chartInstance?.dispose();
    this.resultsChartInstance?.dispose();
    this.chartInstance = undefined;
    this.resultsChartInstance = undefined;
  }

  @HostListener('window:resize')
  onResize() {
    this.triggerAllChartsResize();
  }

  private triggerAllChartsResize(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.triggerChartResize(this.chartInstance);
    this.triggerChartResize(this.resultsChartInstance);
  }

  private triggerChartResize(chart?: echarts.ECharts): void {
    if (!chart || !isPlatformBrowser(this.platformId)) return;
    chart.resize();
    requestAnimationFrame(() => {
      chart.resize();
      setTimeout(() => chart.resize(), 60);
      setTimeout(() => chart.resize(), 250);
    });
  }

  private initOrUpdateCharts() {
    this.initOrUpdateSuccessChart();
    this.initOrUpdateResultsChart();
  }

  private initOrUpdateSuccessChart() {
    if (!this.chartContainerRef?.nativeElement) return;
    const items = this.historyItems;
    if (items.length === 0) {
      this.chartInstance?.dispose();
      this.chartInstance = undefined;
      return;
    }

    const container = this.chartContainerRef.nativeElement;
    if (!this.chartInstance) {
      this.chartInstance = echarts.init(container);
      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver((entries) => {
          for (const entry of entries) {
            if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
              this.chartInstance?.resize();
              this.cdr.markForCheck();
            }
          }
        });
        this.resizeObserver.observe(container);
      }
    }

    const currentTheme = this.themeService.themeMode();
    const isDark = currentTheme === 'dark' ||
      (currentTheme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    this.lastRenderedTheme = currentTheme;
    this.lastItemsCount = items.length;

    const categories = items.map((item) => {
      const d = new Date(item.timestamp);
      return isNaN(d.getTime())
        ? 'Recent'
        : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    });

    const values = items.map((item) => Math.max(0, Math.min(100, item.successRate)));

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      animationDuration: 800,
      grid: {
        left: 10,
        right: 15,
        top: 15,
        bottom: 12,
        containLabel: true,
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.98)',
        borderColor: isDark ? '#334155' : '#e2e8f0',
        borderWidth: 1,
        padding: [10, 14],
        textStyle: {
          color: isDark ? '#f8fafc' : '#0f172a',
          fontSize: 13,
        },
        extraCssText: 'box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1); border-radius: 8px;',
        formatter: (params: any) => {
          const p = Array.isArray(params) ? params[0] : params;
          const idx = p.dataIndex;
          const item = items[idx];
          const fullTime = item?.timestamp ? new Date(item.timestamp).toLocaleString() : p.name;
          const pagesInfo = item ? `${item.successfulPages} of ${item.totalPages} pages extracted` : '';
          const rate = p.value;
          return `
            <div style="font-weight:700;font-size:13px;margin-bottom:6px;color:${isDark ? '#cbd5e1' : '#475569'};">
              🕒 ${fullTime}
            </div>
            <div style="display:flex;align-items:center;gap:8px;font-size:13px;">
              <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#10b981;box-shadow:0 0 6px #10b981;"></span>
              <span>Success Rate: <strong style="color:${rate >= 80 ? '#10b981' : '#f59e0b'};font-size:14px;">${rate}%</strong></span>
            </div>
            ${pagesInfo ? `<div style="font-size:11px;color:${isDark ? '#94a3b8' : '#64748b'};margin-top:4px;">${pagesInfo}</div>` : ''}
          `;
        },
      },
      xAxis: {
        type: 'category',
        data: categories,
        boundaryGap: false,
        axisLine: {
          lineStyle: {
            color: isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.15)',
          },
        },
        axisTick: { show: false },
        axisLabel: {
          color: isDark ? '#94a3b8' : '#64748b',
          fontSize: 11,
          margin: 12,
        },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 100,
        interval: 25,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          formatter: '{value}%',
          color: isDark ? '#94a3b8' : '#64748b',
          fontSize: 11,
        },
        splitLine: {
          lineStyle: {
            color: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
            type: 'dashed',
          },
        },
      },
      series: [
        {
          name: 'Success Rate',
          type: 'line',
          smooth: true,
          data: values,
          symbol: 'circle',
          symbolSize: 8,
          itemStyle: {
            color: '#10b981',
            borderColor: isDark ? '#0f172a' : '#ffffff',
            borderWidth: 2,
          },
          emphasis: {
            scale: 1.6,
            itemStyle: {
              color: '#10b981',
              borderColor: '#ffffff',
              borderWidth: 2,
              shadowBlur: 10,
              shadowColor: 'rgba(16, 185, 129, 0.6)',
            },
          },
          lineStyle: {
            color: '#10b981',
            width: 3.5,
            shadowColor: 'rgba(16, 185, 129, 0.35)',
            shadowBlur: 8,
            shadowOffsetY: 4,
          },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(16, 185, 129, 0.38)' },
              { offset: 1, color: 'rgba(16, 185, 129, 0.01)' },
            ]),
          },
        },
      ],
    };

    this.chartInstance.setOption(option);
    this.triggerChartResize(this.chartInstance);
  }

  private initOrUpdateResultsChart() {
    if (!this.resultsChartContainerRef?.nativeElement) return;
    const items = this.historyItems;
    if (items.length === 0) {
      this.resultsChartInstance?.dispose();
      this.resultsChartInstance = undefined;
      return;
    }

    const container = this.resultsChartContainerRef.nativeElement;
    if (!this.resultsChartInstance) {
      this.resultsChartInstance = echarts.init(container);
      if (typeof ResizeObserver !== 'undefined') {
        this.resultsResizeObserver = new ResizeObserver((entries) => {
          for (const entry of entries) {
            if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
              this.resultsChartInstance?.resize();
              this.cdr.markForCheck();
            }
          }
        });
        this.resultsResizeObserver.observe(container);
      }
    }

    const currentTheme = this.themeService.themeMode();
    const isDark = currentTheme === 'dark' ||
      (currentTheme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    const categories = items.map((item) => {
      const d = new Date(item.timestamp);
      return isNaN(d.getTime())
        ? 'Recent'
        : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    });

    const values = items.map((item) => item.totalListings ?? 0);

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      animationDuration: 800,
      grid: {
        left: 10,
        right: 15,
        top: 15,
        bottom: 12,
        containLabel: true,
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
          shadowStyle: {
            color: isDark ? 'rgba(99, 102, 241, 0.12)' : 'rgba(99, 102, 241, 0.08)',
          },
        },
        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.98)',
        borderColor: isDark ? '#334155' : '#e2e8f0',
        borderWidth: 1,
        padding: [10, 14],
        textStyle: {
          color: isDark ? '#f8fafc' : '#0f172a',
          fontSize: 13,
        },
        extraCssText: 'box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1); border-radius: 8px;',
        formatter: (params: any) => {
          const p = Array.isArray(params) ? params[0] : params;
          const idx = p.dataIndex;
          const item = items[idx];
          const fullTime = item?.timestamp ? new Date(item.timestamp).toLocaleString() : p.name;
          const inStock = item?.inStockCount != null ? `${item.inStockCount} in stock` : '';
          const pagesInfo = item ? `${item.successfulPages} of ${item.totalPages} pages` : '';
          const count = p.value;
          return `
            <div style="font-weight:700;font-size:13px;margin-bottom:6px;color:${isDark ? '#cbd5e1' : '#475569'};">
              🕒 ${fullTime}
            </div>
            <div style="display:flex;align-items:center;gap:8px;font-size:13px;">
              <span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#6366f1;box-shadow:0 0 6px #6366f1;"></span>
              <span>Results Extracted: <strong style="color:#6366f1;font-size:14px;">${count} deals</strong></span>
            </div>
            ${inStock || pagesInfo ? `<div style="font-size:11px;color:${isDark ? '#94a3b8' : '#64748b'};margin-top:4px;">${[inStock, pagesInfo].filter(Boolean).join(' • ')}</div>` : ''}
          `;
        },
      },
      xAxis: {
        type: 'category',
        data: categories,
        boundaryGap: true,
        axisLine: {
          lineStyle: {
            color: isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.15)',
          },
        },
        axisTick: { show: false },
        axisLabel: {
          color: isDark ? '#94a3b8' : '#64748b',
          fontSize: 11,
          margin: 12,
        },
      },
      yAxis: {
        type: 'value',
        min: 0,
        minInterval: 1,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: isDark ? '#94a3b8' : '#64748b',
          fontSize: 11,
        },
        splitLine: {
          lineStyle: {
            color: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
            type: 'dashed',
          },
        },
      },
      series: [
        {
          name: 'Results Extracted',
          type: 'bar',
          data: values,
          barMaxWidth: 38,
          itemStyle: {
            borderRadius: [6, 6, 0, 0],
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#818cf8' },
              { offset: 1, color: '#4f46e5' },
            ]),
          },
          emphasis: {
            itemStyle: {
              borderRadius: [6, 6, 0, 0],
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: '#a5b4fc' },
                { offset: 1, color: '#6366f1' },
              ]),
              shadowBlur: 10,
              shadowColor: 'rgba(99, 102, 241, 0.5)',
            },
          },
        },
      ],
    };

    this.resultsChartInstance.setOption(option);
    this.triggerChartResize(this.resultsChartInstance);
  }

  providersCount(): number {
    return this.apiService.dashboardData()?.providers?.length ?? 1;
  }

  pagesCount(): number {
    return this.apiService.dashboardData()?.pages?.filter((p) => p.enabled)?.length ?? 0;
  }

  lastScrapedTime(): string {
    const statuses = this.apiService.dashboardData()?.statuses || [];
    if (!statuses.length) return 'Not scraped yet';
    const dates = statuses
      .map((s) => new Date(s.scrapedAt).getTime())
      .filter((t) => !isNaN(t));
    if (!dates.length) return 'Not scraped yet';
    return new Date(Math.max(...dates)).toLocaleString();
  }

  getEarliestUpcomingScheduler(): SchedulerState | undefined {
    const data = this.apiService.dashboardData();
    const list =
      data?.schedulers && data.schedulers.length > 0
        ? data.schedulers.filter((s) => s.enabled && s.nextRunAt)
        : data?.scheduler && data.scheduler.enabled && data.scheduler.nextRunAt
          ? [data.scheduler]
          : [];

    if (list.length === 0) {
      return data?.scheduler?.enabled
        ? data.scheduler
        : data?.schedulers?.find((s) => s.enabled) || undefined;
    }

    return list.sort(
      (a, b) => new Date(a.nextRunAt!).getTime() - new Date(b.nextRunAt!).getTime(),
    )[0];
  }

  nextCronTime(): string {
    const sched = this.getEarliestUpcomingScheduler();
    if (!sched || !sched.enabled) return 'Disabled';
    if (!sched.nextRunAt) return 'Pending Roll';
    const nextDate = new Date(sched.nextRunAt);
    if (isNaN(nextDate.getTime())) return 'Pending Roll';

    const now = new Date();
    const isToday = nextDate.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = nextDate.toDateString() === tomorrow.toDateString();

    const timeStr = nextDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = nextDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

    if (isTomorrow) {
      return `Tomorrow (${dateStr}), ${timeStr}`;
    }
    if (isToday) {
      return `Today (${dateStr}), ${timeStr}`;
    }
    return `${dateStr}, ${timeStr}`;
  }

  cronWindow(): string {
    const sched = this.getEarliestUpcomingScheduler();
    if (!sched || !sched.enabled) return 'Cron scheduler is currently off';
    const schedPrefix = sched.name ? `${sched.name}: ` : '';
    return `${schedPrefix}Base ${sched.baseTime} + 0..${sched.jitterMinutes}m random jitter`;
  }

  private updateProvidersList() {
    const data = this.apiService.dashboardData();
    if (!data) return;

    const providers = data.providers?.length ? data.providers : ['eneba'];
    const statuses = data.statuses || [];

    const rows: ProviderRow[] = providers.map((prov) => {
      const activePages = data.pages?.filter((p) => ((p.provider || p.category)?.toLowerCase() === prov.toLowerCase()) && p.enabled).length || 0;
      const provStatuses = statuses.filter((s) => (s.category?.toLowerCase() === prov.toLowerCase()) || (s.pageUrl?.toLowerCase().includes(prov.toLowerCase())));
      let lastScraped = 'Never';
      let lastScrapedRaw = '';

      if (provStatuses.length > 0) {
        const dates = provStatuses.map((s) => new Date(s.scrapedAt).getTime()).filter((t) => !isNaN(t));
        if (dates.length) {
          const maxDate = new Date(Math.max(...dates));
          lastScraped = maxDate.toLocaleString();
          lastScrapedRaw = maxDate.toISOString();
        }
      }

      return {
        provider: prov,
        activePages,
        status: activePages > 0 ? 'Active' : 'Idle',
        lastScraped,
        lastScrapedRaw,
      };
    });

    this.sortedProviders = rows;
  }

  sortProviders(sort: Sort) {
    const data = [...this.sortedProviders];
    if (!sort.active || sort.direction === '') {
      this.sortedProviders = data;
      return;
    }

    this.sortedProviders = data.sort((a, b) => {
      const isAsc = sort.direction === 'asc';
      switch (sort.active) {
        case 'provider': return compare(a.provider, b.provider, isAsc);
        case 'activePages': return compare(a.activePages, b.activePages, isAsc);
        case 'status': return compare(a.status, b.status, isAsc);
        case 'lastScraped': return compare(a.lastScrapedRaw || '', b.lastScrapedRaw || '', isAsc);
        default: return 0;
      }
    });
  }
}

function compare(a: number | string, b: number | string, isAsc: boolean) {
  return (a < b ? -1 : 1) * (isAsc ? 1 : -1);
}
