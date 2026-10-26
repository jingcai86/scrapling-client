import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ApiService } from '../../core/services/api.service';

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
  `],
})
export class HomeComponent {
  displayedColumns: string[] = ['provider', 'activePages', 'status', 'lastScraped', 'actions'];
  sortedProviders: ProviderRow[] = [];

  constructor(private apiService: ApiService) {}

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
