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
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import * as echarts from 'echarts';
import { ApiService } from '../../core/services/api.service';
import { ThemeService } from '../../core/services/theme.service';
import type { ScrapeHistoryItem } from '../../core/models/dashboard.model';

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
  ],
  template: `
    <div class="page-container">
      <!-- High Level KPI Cards -->
      <div class="kpi-grid">
        <mat-card class="kpi-card" appearance="outlined">
          <mat-card-header>
            <mat-card-subtitle>Monitored Providers</mat-card-subtitle>
            <mat-card-title class="kpi-value">{{ providersCount() }}</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="kpi-sub">{{ pagesCount() }} active scrape pages</div>
          </mat-card-content>
        </mat-card>

        <mat-card class="kpi-card" appearance="outlined">
          <mat-card-header>
            <mat-card-subtitle>Last Global Scrape</mat-card-subtitle>
            <mat-card-title class="kpi-value time-val">{{ lastScrapedTime() }}</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="kpi-sub">Across all configured categories</div>
          </mat-card-content>
        </mat-card>

        <mat-card class="kpi-card" appearance="outlined">
          <mat-card-header>
            <mat-card-subtitle>Next Scheduled Scrape</mat-card-subtitle>
            <mat-card-title class="kpi-value highlight">{{ nextCronTime() }}</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="kpi-sub">{{ cronWindow() }}</div>
          </mat-card-content>
        </mat-card>

        <mat-card class="kpi-card" appearance="outlined">
          <mat-card-header>
            <mat-card-subtitle>Avg Scraping Success</mat-card-subtitle>
            <mat-card-title class="kpi-value" [class.success]="avgSuccessRateNum >= 80">{{ avgSuccessRate }}</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="kpi-sub">Extraction reliability across runs</div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Scraping Success Rate Over Time (Apache ECharts) -->
      <mat-card class="main-card chart-card" appearance="outlined">
        <mat-card-header class="chart-header">
          <div>
            <mat-card-title class="chart-title">
              <span class="material-symbols-outlined chart-icon">monitoring</span>
              <span>Scraping Success Rate Over Time</span>
            </mat-card-title>
            <mat-card-subtitle>
              Real-time Apache ECharts trend line of page extraction success rate (0% – 100%) across scheduled and manual runs.
            </mat-card-subtitle>
          </div>
          <div class="chart-kpis" *ngIf="historyItems.length > 0">
            <div class="stat-pill">
              <span class="stat-label">Avg Success:</span>
              <span class="stat-val" [class.success]="avgSuccessRateNum >= 80">{{ avgSuccessRate }}</span>
            </div>
            <div class="stat-pill">
              <span class="stat-label">Total Runs:</span>
              <span class="stat-val">{{ historyItems.length }}</span>
            </div>
          </div>
        </mat-card-header>

        <mat-card-content class="chart-content">
          <div
            #chartContainer
            class="echarts-container"
            [style.display]="historyItems.length > 0 ? 'block' : 'none'"
          ></div>

          <div *ngIf="historyItems.length === 0" class="empty-chart">
            <span class="material-symbols-outlined empty-icon">show_chart</span>
            <p>No scraping history recorded yet. Run a scrape to populate success rate metrics.</p>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Provider Overview Table -->
      <mat-card class="main-card" appearance="outlined">
        <mat-card-header class="table-header">
          <div>
            <mat-card-title>Monitored Store Providers</mat-card-title>
            <mat-card-subtitle>
              Overview of configured store providers and when they were last scraped. All scraped deals are located within their dedicated store tab.
            </mat-card-subtitle>
          </div>
        </mat-card-header>
        <mat-card-content class="card-table-content">
          <table mat-table [dataSource]="sortedProviders" matSort (matSortChange)="sortProviders($event)" class="data-table">
            <ng-container matColumnDef="provider">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Provider</th>
              <td mat-cell *matCellDef="let p">
                <span class="provider-pill">{{ p.provider | uppercase }}</span>
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
                <span class="status-badge" [class.active]="p.status === 'Active'">
                  ● {{ p.status }}
                </span>
              </td>
            </ng-container>

            <ng-container matColumnDef="lastScraped">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Last Scraped</th>
              <td mat-cell *matCellDef="let p">{{ p.lastScraped }}</td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef>Store Deals</th>
              <td mat-cell *matCellDef="let p">
                <a mat-stroked-button color="primary" [routerLink]="['/' + p.provider]" class="btn-xs">
                  View {{ p.provider | titlecase }} Deals →
                </a>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
          </table>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .page-container {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1rem;
    }
    .kpi-card {
      background: var(--mat-sys-surface-container);
      border-radius: 12px;
    }
    .kpi-value {
      font-size: 2rem;
      font-weight: 800;
      color: var(--mat-sys-primary);
      margin: 0.25rem 0;

      &.highlight {
        color: #818cf8;
      }
      &.success {
        color: #10b981;
      }
      &.time-val {
        font-size: 1.25rem;
        line-height: 2rem;
      }
    }
    .kpi-sub {
      font-size: 0.8rem;
      color: var(--mat-sys-on-surface-variant);
    }
    .main-card {
      background: var(--mat-sys-surface-container);
      border-radius: 12px;
    }
    .chart-card {
      background: var(--mat-sys-surface-container);
      border-radius: 12px;
      overflow: hidden;
    }
    .chart-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
      padding: 1.25rem 1.5rem 0.5rem;
    }
    .chart-title {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      font-size: 1.25rem;
      font-weight: 700;
    }
    .chart-icon {
      color: #10b981;
      font-size: 1.5rem;
    }
    .chart-kpis {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }
    .stat-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.35rem 0.75rem;
      border-radius: 8px;
      background: var(--mat-sys-surface-container-high);
      border: 1px solid var(--mat-sys-outline-variant);
      font-size: 0.82rem;
    }
    .stat-label {
      color: var(--mat-sys-on-surface-variant);
    }
    .stat-val {
      font-weight: 700;
      color: var(--mat-sys-on-surface);
      &.success {
        color: #10b981;
      }
    }
    .chart-content {
      padding: 0 1.25rem 1.25rem !important;
      position: relative;
    }
    .echarts-container {
      width: 100%;
      height: 300px;
    }
    .empty-chart {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 260px;
      color: var(--mat-sys-outline);
      gap: 0.5rem;
    }
    .empty-icon {
      font-size: 2.5rem;
    }
    .table-header {
      padding: 1.25rem 1.5rem 0.5rem;
    }
    .card-table-content {
      padding: 0 !important;
      overflow-x: auto;
    }
    .data-table {
      width: 100%;
      background: transparent;
    }
    .provider-pill {
      font-weight: 700;
      letter-spacing: 0.05em;
      color: var(--mat-sys-primary);
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.2rem 0.6rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      background: var(--mat-sys-surface-container-high);
      color: var(--mat-sys-outline);

      &.active {
        background: rgba(16, 185, 129, 0.15);
        color: #10b981;
      }
    }
    .btn-xs {
      font-size: 0.8rem;
      padding: 0 0.75rem;
      height: 32px;
    }
  `],
})
export class HomeComponent implements AfterViewInit, OnDestroy, DoCheck {
  displayedColumns: string[] = ['provider', 'activePages', 'status', 'lastScraped', 'actions'];
  sortedProviders: ProviderRow[] = [];

  @ViewChild('chartContainer') chartContainerRef?: ElementRef<HTMLDivElement>;
  private chartInstance?: echarts.ECharts;
  private resizeObserver?: ResizeObserver;
  private lastRenderedTheme?: string;
  private lastItemsCount = -1;

  constructor(
    private apiService: ApiService,
    private themeService: ThemeService,
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

  get avgSuccessRateNum(): number {
    const items = this.historyItems;
    if (!items.length) return 100;
    const sum = items.reduce((acc, i) => acc + i.successRate, 0);
    return Number((sum / items.length).toFixed(1));
  }

  get avgSuccessRate(): string {
    return `${this.avgSuccessRateNum}%`;
  }

  ngAfterViewInit() {
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => this.initOrUpdateChart(), 0);
    }
  }

  ngDoCheck() {
    this.updateProvidersList();
    if (isPlatformBrowser(this.platformId)) {
      const currentTheme = this.themeService.themeMode();
      const currentCount = this.historyItems.length;
      if (currentTheme !== this.lastRenderedTheme || currentCount !== this.lastItemsCount) {
        this.initOrUpdateChart();
      }
    }
  }

  ngOnDestroy() {
    this.resizeObserver?.disconnect();
    this.chartInstance?.dispose();
    this.chartInstance = undefined;
  }

  @HostListener('window:resize')
  onResize() {
    this.chartInstance?.resize();
  }

  private initOrUpdateChart() {
    if (!this.chartContainerRef?.nativeElement) return;
    const items = this.historyItems;
    if (items.length === 0) {
      this.chartInstance?.dispose();
      this.chartInstance = undefined;
      return;
    }

    if (!this.chartInstance) {
      this.chartInstance = echarts.init(this.chartContainerRef.nativeElement);
      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => {
          this.chartInstance?.resize();
        });
        this.resizeObserver.observe(this.chartContainerRef.nativeElement);
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
        left: 20,
        right: 25,
        top: 25,
        bottom: 25,
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

  nextCronTime(): string {
    const sched = this.apiService.dashboardData()?.scheduler;
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
    const sched = this.apiService.dashboardData()?.scheduler;
    if (!sched || !sched.enabled) return 'Cron scheduler is currently off';
    return `Base ${sched.baseTime} + 0..${sched.jitterMinutes}m random jitter`;
  }

  private updateProvidersList() {
    const data = this.apiService.dashboardData();
    if (!data) return;

    const providers = data.providers?.length ? data.providers : ['eneba'];
    const statuses = data.statuses || [];

    const rows: ProviderRow[] = providers.map((prov) => {
      const activePages = data.pages?.filter((p) => p.provider === prov && p.enabled).length || 0;
      const provStatuses = statuses.filter((s) => s.pageUrl.includes(prov) || prov === 'eneba');
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
