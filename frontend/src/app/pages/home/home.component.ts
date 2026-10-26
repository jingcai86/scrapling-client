import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ApiService } from '../../core/services/api.service';
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
            <mat-card-subtitle>Last Scraped</mat-card-subtitle>
            <mat-card-title class="kpi-value small-text">{{ lastScrapedTime() }}</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="kpi-sub">Provider: eneba</div>
          </mat-card-content>
        </mat-card>

        <mat-card class="kpi-card" appearance="outlined">
          <mat-card-header>
            <mat-card-subtitle>Next Scheduled Scrape</mat-card-subtitle>
            <mat-card-title class="kpi-value small-text next-cron">{{ nextCronTime() }}</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="kpi-sub">{{ cronWindow() }}</div>
          </mat-card-content>
        </mat-card>

        <mat-card class="kpi-card" appearance="outlined">
          <mat-card-header>
            <mat-card-subtitle>Engine & Storage Status</mat-card-subtitle>
            <mat-card-title class="kpi-value status-active">Active</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="kpi-sub">PostgreSQL (scrapling schema)</div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Scraping Success Rate Over Time (Line Chart) -->
      <mat-card class="main-card chart-card" appearance="outlined">
        <mat-card-header class="chart-header">
          <div>
            <mat-card-title class="chart-title">
              <span class="material-symbols-outlined chart-icon">monitoring</span>
              <span>Scraping Success Rate Over Time</span>
            </mat-card-title>
            <mat-card-subtitle>
              Real-time trend line of page extraction success rate (0% – 100%) across scheduled and manual runs.
            </mat-card-subtitle>
          </div>
          <div class="chart-kpis" *ngIf="chartPoints.length > 0">
            <div class="stat-pill">
              <span class="stat-label">Avg Success Rate:</span>
              <span class="stat-val" [class.success]="avgSuccessRateNum >= 80">{{ avgSuccessRate }}</span>
            </div>
            <div class="stat-pill">
              <span class="stat-label">Total Runs:</span>
              <span class="stat-val">{{ chartPoints.length }}</span>
            </div>
          </div>
        </mat-card-header>

        <mat-card-content class="chart-content">
          <!-- Active Tooltip Banner on hover -->
          <div class="tooltip-bar" *ngIf="hoveredPoint">
            <span class="tooltip-time">🕒 {{ hoveredPoint.fullTime }}</span>
            <span class="tooltip-rate" [class.high]="hoveredPoint.rate >= 80">
              ● {{ hoveredPoint.rate }}% Success Rate
            </span>
            <span class="tooltip-meta">({{ hoveredPoint.successfulPages }}/{{ hoveredPoint.totalPages }} pages extracted)</span>
          </div>

          <div class="svg-container" *ngIf="chartPoints.length > 0; else noHistory">
            <svg viewBox="0 0 840 260" preserveAspectRatio="none" class="chart-svg">
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#10b981" stop-opacity="0.32" />
                  <stop offset="100%" stop-color="#10b981" stop-opacity="0.0" />
                </linearGradient>
              </defs>

              <!-- Horizontal Grid Lines & Y-Axis Labels -->
              <!-- Y: 100% (25) -->
              <line x1="60" y1="25" x2="810" y2="25" class="grid-line" />
              <text x="50" y="29" class="y-label" text-anchor="end">100%</text>

              <!-- Y: 75% (72.5) -->
              <line x1="60" y1="72.5" x2="810" y2="72.5" class="grid-line" />
              <text x="50" y="76.5" class="y-label" text-anchor="end">75%</text>

              <!-- Y: 50% (120) -->
              <line x1="60" y1="120" x2="810" y2="120" class="grid-line" />
              <text x="50" y="124" class="y-label" text-anchor="end">50%</text>

              <!-- Y: 25% (167.5) -->
              <line x1="60" y1="167.5" x2="810" y2="167.5" class="grid-line" />
              <text x="50" y="171.5" class="y-label" text-anchor="end">25%</text>

              <!-- Y: 0% (215) Baseline -->
              <line x1="60" y1="215" x2="810" y2="215" class="grid-line baseline" />
              <text x="50" y="219" class="y-label" text-anchor="end">0%</text>

              <!-- Gradient Area Fill -->
              <path [attr.d]="areaPath" fill="url(#chartGradient)" />

              <!-- Trend Line -->
              <path [attr.d]="linePath" fill="none" class="chart-line" />

              <!-- Interactive Data Points & X-Labels -->
              <g *ngFor="let pt of chartPoints">
                <circle
                  [attr.cx]="pt.x"
                  [attr.cy]="pt.y"
                  r="6"
                  class="chart-circle"
                  (mouseenter)="hoveredPoint = pt"
                  (mouseleave)="hoveredPoint = null"
                >
                  <title>{{ pt.fullTime }}: {{ pt.rate }}% Success ({{ pt.successfulPages }}/{{ pt.totalPages }} pages)</title>
                </circle>
                <text
                  [attr.x]="pt.x"
                  y="245"
                  class="x-label"
                  text-anchor="middle"
                >
                  {{ pt.timeLabel }}
                </text>
              </g>
            </svg>
          </div>

          <ng-template #noHistory>
            <div class="empty-chart">
              <span class="material-symbols-outlined empty-icon">show_chart</span>
              <p>No scraping history recorded yet. Run a scrape to populate success rate metrics.</p>
            </div>
          </ng-template>
        </mat-card-content>
      </mat-card>

      <!-- Provider Overview Table -->
      <mat-card class="main-card" appearance="outlined">
        <mat-card-header>
          <div>
            <mat-card-title>Monitored Store Providers</mat-card-title>
            <mat-card-subtitle>
              Overview of configured store providers and when they were last scraped. All scraped deals are located within their dedicated store tab.
            </mat-card-subtitle>
          </div>
        </mat-card-header>
        <mat-card-content class="card-table-content">
          <table mat-table [dataSource]="sortedProviders" matSort (matSortChange)="sortProviders($event)" class="providers-table">
            <ng-container matColumnDef="provider">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Provider</th>
              <td mat-cell *matCellDef="let row">
                <span class="provider-badge">{{ row.provider }}</span>
              </td>
            </ng-container>

            <ng-container matColumnDef="activePages">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Tracked Pages</th>
              <td mat-cell *matCellDef="let row">
                {{ row.activePages }} pages
              </td>
            </ng-container>

            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Status</th>
              <td mat-cell *matCellDef="let row">
                <span class="status-badge" [class.ready]="row.status === 'Ready' || row.status === 'Active'">
                  ● {{ row.status }}
                </span>
              </td>
            </ng-container>

            <ng-container matColumnDef="lastScraped">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Last Scraped</th>
              <td mat-cell *matCellDef="let row">
                {{ row.lastScraped }}
              </td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef>Store Deals</th>
              <td mat-cell *matCellDef="let row">
                <a mat-stroked-button color="primary" [routerLink]="'/' + row.provider">
                  View {{ row.provider | titlecase }} Deals →
                </a>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>

            <tr class="mat-row" *matNoDataRow>
              <td class="mat-cell empty-cell" [attr.colspan]="displayedColumns.length">
                No store providers configured.
              </td>
            </tr>
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
      &.small-text {
        font-size: 1.15rem;
      }
      &.status-active {
        color: #10b981;
      }
      &.next-cron {
        color: #818cf8;
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
    .card-table-content {
      padding: 0 !important;
      overflow-x: auto;
    }
    .providers-table {
      width: 100%;
      background: transparent;
    }
    .provider-badge {
      font-weight: 700;
      text-transform: capitalize;
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
      padding: 0.2rem 0.6rem;
      border-radius: 6px;
    }
    .status-badge {
      font-weight: 600;
      font-size: 0.82rem;
      color: var(--mat-sys-outline);
      &.ready {
        color: #10b981;
      }
    }
    .empty-cell {
      text-align: center;
      padding: 2rem;
      color: var(--mat-sys-outline);
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
      padding: 1.25rem 1.25rem 0.5rem;
    }
    .chart-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--mat-sys-on-surface);
    }
    .chart-icon {
      color: #10b981;
    }
    .chart-kpis {
      display: flex;
      gap: 0.75rem;
      align-items: center;
      flex-wrap: wrap;
    }
    .stat-pill {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.35rem 0.75rem;
      background: var(--mat-sys-surface-container-high);
      border-radius: 8px;
      font-size: 0.82rem;
    }
    .stat-label {
      color: var(--mat-sys-on-surface-variant);
    }
    .stat-val {
      font-weight: 700;
      &.success {
        color: #10b981;
      }
    }
    .chart-content {
      padding: 0.5rem 1.25rem 1.25rem !important;
    }
    .tooltip-bar {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      padding: 0.5rem 0.85rem;
      background: var(--mat-sys-surface-container-highest);
      border-radius: 8px;
      margin-bottom: 0.75rem;
      font-size: 0.82rem;
    }
    .tooltip-time {
      font-weight: 600;
    }
    .tooltip-rate {
      font-weight: 700;
      color: #f59e0b;
      &.high {
        color: #10b981;
      }
    }
    .tooltip-meta {
      color: var(--mat-sys-on-surface-variant);
    }
    .svg-container {
      width: 100%;
      height: 260px;
      position: relative;
    }
    .chart-svg {
      width: 100%;
      height: 100%;
      overflow: visible;
    }
    .grid-line {
      stroke: var(--mat-sys-outline-variant);
      stroke-width: 1;
      stroke-dasharray: 4 4;
      opacity: 0.7;
      &.baseline {
        stroke-dasharray: none;
        opacity: 0.9;
      }
    }
    .y-label {
      font-size: 11px;
      fill: var(--mat-sys-on-surface-variant);
      font-weight: 500;
      font-family: inherit;
    }
    .x-label {
      font-size: 11px;
      fill: var(--mat-sys-on-surface-variant);
      font-weight: 500;
      font-family: inherit;
    }
    .chart-line {
      stroke: #10b981;
      stroke-width: 3;
    }
    .chart-circle {
      fill: #10b981;
      stroke: var(--mat-sys-surface);
      stroke-width: 2.5;
      cursor: pointer;
      transition: r 0.2s ease, stroke-width 0.2s ease;
      &:hover {
        r: 8;
        stroke-width: 3.5;
      }
    }
    .empty-chart {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 3rem 1rem;
      color: var(--mat-sys-outline);
      gap: 0.5rem;
    }
    .empty-icon {
      font-size: 2.5rem;
    }
  `],
})
export class HomeComponent {
  displayedColumns: string[] = ['provider', 'activePages', 'status', 'lastScraped', 'actions'];
  sortedProviders: ProviderRow[] = [];
  hoveredPoint: any = null;

  constructor(private apiService: ApiService) {}

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

  get chartPoints(): Array<{
    x: number;
    y: number;
    rate: number;
    timeLabel: string;
    fullTime: string;
    totalPages: number;
    successfulPages: number;
  }> {
    const items = this.historyItems;
    if (items.length === 0) return [];

    const padLeft = 60;
    const padRight = 30;
    const chartW = 840 - padLeft - padRight;
    const topY = 25;
    const bottomY = 215;
    const chartH = bottomY - topY;

    return items.map((item, idx) => {
      const x =
        items.length === 1
          ? padLeft + chartW / 2
          : padLeft + (idx / (items.length - 1)) * chartW;
      const rate = Math.max(0, Math.min(100, item.successRate));
      const y = bottomY - (rate / 100) * chartH;
      const d = new Date(item.timestamp);
      const timeLabel = isNaN(d.getTime())
        ? 'Recent'
        : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const fullTime = isNaN(d.getTime()) ? 'Recent' : d.toLocaleString();

      return {
        x,
        y,
        rate,
        timeLabel,
        fullTime,
        totalPages: item.totalPages,
        successfulPages: item.successfulPages,
      };
    });
  }

  get linePath(): string {
    const pts = this.chartPoints;
    if (pts.length === 0) return '';
    if (pts.length === 1) {
      return `M ${pts[0].x - 50} ${pts[0].y} L ${pts[0].x + 50} ${pts[0].y}`;
    }
    return pts
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ');
  }

  get areaPath(): string {
    const pts = this.chartPoints;
    if (pts.length === 0) return '';
    const bottomY = 215;
    if (pts.length === 1) {
      return `M ${pts[0].x - 50} ${bottomY} L ${pts[0].x - 50} ${pts[0].y} L ${pts[0].x + 50} ${pts[0].y} L ${pts[0].x + 50} ${bottomY} Z`;
    }
    const line = pts
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ');
    const first = pts[0];
    const last = pts[pts.length - 1];
    return `${line} L ${last.x.toFixed(1)} ${bottomY} L ${first.x.toFixed(1)} ${bottomY} Z`;
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

  ngDoCheck() {
    this.updateProvidersList();
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
