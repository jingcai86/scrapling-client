import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../../core/services/api.service';
import { PageFormDialogComponent } from '../../dialogs/page-form-dialog.component';
import { CronFormDialogComponent } from '../../dialogs/cron-form-dialog.component';
import type { ScrapePageConfig } from '../../core/models/dashboard.model';

@Component({
  selector: 'app-scraping',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatTableModule,
    MatSortModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatSnackBarModule,
    MatSlideToggleModule,
    MatTooltipModule,
  ],
  template: `
    <div class="page-container">
      <!-- 1. Scraping Actions & Console -->
      <mat-card class="main-card" appearance="outlined">
        <mat-card-header class="card-header-flex">
          <mat-card-title>Scheduled Actions &amp; Live Execution Console</mat-card-title>
          <mat-card-subtitle>
            Trigger an immediate scrape across all enabled pages or monitor automated scheduled executions.
          </mat-card-subtitle>
          <div class="action-buttons">
            <button mat-flat-button color="primary" (click)="scrapeAll(true)" [disabled]="isScraping()">
              ▶ Full Scrape (+ Seller Details)
            </button>
            <button mat-stroked-button (click)="scrapeAll(false)" [disabled]="isScraping()">
              ⚡ Fast Scrape (Catalog Only)
            </button>
          </div>
        </mat-card-header>
        <mat-card-content>
          <div class="console-box">
            <div *ngFor="let log of recentLogs()" class="log-line">{{ log }}</div>
            <div *ngIf="!recentLogs()?.length" class="log-line muted">Ready. Waiting for scrape actions.</div>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- 2. Randomized Daily Cron Schedule Card -->
      <mat-card class="main-card" appearance="outlined">
        <mat-card-header class="card-header-flex">
          <mat-card-title>Daily Randomized Cron Schedule</mat-card-title>
          <mat-card-subtitle>
            Runs daily at <code>CRON_BASE_TIME</code> plus a random delay (0 to <code>CRON_JITTER_MINUTES</code>).
          </mat-card-subtitle>
          <div class="action-buttons">
            <button mat-stroked-button (click)="rerollCron()">
              🎲 Re-Roll Random Time
            </button>
            <button mat-flat-button color="primary" (click)="openCronDialog()">
              ✎ Edit Schedule
            </button>
          </div>
        </mat-card-header>
        <mat-card-content>
          <div class="kv-grid">
            <div class="kv-box">
              <div class="kv-label">Scheduler Status</div>
              <div class="kv-val" [class.enabled]="scheduler()?.enabled">
                {{ scheduler()?.enabled ? 'Active (Enabled)' : 'Disabled' }}
              </div>
            </div>
            <div class="kv-box">
              <div class="kv-label">Daily Window</div>
              <div class="kv-val">
                {{ scheduler()?.baseTime || '19:00' }} + 0..{{ scheduler()?.jitterMinutes || 60 }}m
              </div>
            </div>
            <div class="kv-box">
              <div class="kv-label">Next Scheduled Run</div>
              <div class="kv-val highlight">{{ formatNextRun(scheduler()?.nextRunAt) }}</div>
            </div>
            <div class="kv-box">
              <div class="kv-label">Last Scheduled Run</div>
              <div class="kv-val">{{ formatNextRun(scheduler()?.lastRunAt) }}</div>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- 3. Target Scraping Pages Table -->
      <mat-card class="main-card" appearance="outlined">
        <mat-card-header class="card-header-flex">
          <mat-card-title>Target Scraping Pages</mat-card-title>
          <mat-card-subtitle>
            Click any column header to sort. Manage store URLs across providers or trigger a single-page scrape.
          </mat-card-subtitle>
          <button mat-flat-button color="primary" (click)="openAddPageDialog()">
            + Add Scraping Page
          </button>
        </mat-card-header>
        <mat-card-content class="card-table-content">
          <div class="table-wrapper">
            <table mat-table [dataSource]="sortedPages" matSort (matSortChange)="sortPages($event)" class="data-table">
              <ng-container matColumnDef="categoryName">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Category Name</th>
                <td mat-cell *matCellDef="let page">
                  <strong class="cat-title">{{ page.categoryName }}</strong>
                </td>
              </ng-container>

              <ng-container matColumnDef="provider">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Provider</th>
                <td mat-cell *matCellDef="let page">
                  <span class="badge badge-provider">{{ page.provider }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="url">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Store Page URL</th>
                <td mat-cell *matCellDef="let page" class="url-cell">
                  <a [href]="page.url" target="_blank" rel="noopener" class="store-link" [title]="page.url">
                    <span class="url-text">{{ page.url }}</span> ↗
                  </a>
                </td>
              </ng-container>

              <ng-container matColumnDef="withOffers">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Additional Scraping</th>
                <td mat-cell *matCellDef="let page">
                  <mat-slide-toggle
                    [checked]="page.withOffers"
                    (change)="toggleOffers(page, $event.checked)"
                    [matTooltip]="page.withOffers ? 'Additional scraping (seller offers & merchant details) enabled' : 'Catalog only (faster)'"
                  >
                    <span style="font-size:0.8rem;font-weight:600;" [style.color]="page.withOffers ? '#10b981' : 'var(--mat-sys-outline)'">
                      {{ page.withOffers ? 'Include Sellers' : 'Catalog Only' }}
                    </span>
                  </mat-slide-toggle>
                </td>
              </ng-container>

              <ng-container matColumnDef="enabled">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Enabled</th>
                <td mat-cell *matCellDef="let page">
                  <mat-slide-toggle
                    [checked]="page.enabled"
                    (change)="toggleEnabled(page, $event.checked)"
                    [matTooltip]="page.enabled ? 'Page active for scheduled & batch scrapes' : 'Page disabled (skipped during scrapes)'"
                  >
                    <span style="font-size:0.8rem;font-weight:600;" [style.color]="page.enabled ? '#10b981' : 'var(--mat-sys-outline)'">
                      {{ page.enabled ? 'Active' : 'Disabled' }}
                    </span>
                  </mat-slide-toggle>
                </td>
              </ng-container>

              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef class="col-actions">Actions</th>
                <td mat-cell *matCellDef="let page" class="col-actions">
                  <div class="row-actions">
                    <button mat-icon-button (click)="scrapeSingle(page)" matTooltip="Scrape this page now" [disabled]="isScraping()">
                      <mat-icon>play_arrow</mat-icon>
                    </button>
                    <button mat-icon-button (click)="openEditPageDialog(page)" matTooltip="Edit page">
                      <mat-icon>edit</mat-icon>
                    </button>
                    <button mat-icon-button color="warn" (click)="deletePage(page)" matTooltip="Delete page">
                      <mat-icon>delete</mat-icon>
                    </button>
                  </div>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
            </table>
          </div>
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
    .main-card {
      background: var(--mat-sys-surface-container);
      border-radius: 12px;
    }
    .card-header-flex {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
    }
    .action-buttons {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .console-box {
      background: #090d16;
      color: #38bdf8;
      font-family: ui-monospace, Menlo, Monaco, 'Cascadia Mono', monospace;
      font-size: 0.8rem;
      padding: 0.85rem 1rem;
      border-radius: 8px;
      max-height: 220px;
      overflow-y: auto;
      border: 1px solid var(--mat-sys-outline-variant);
      margin-top: 0.75rem;
    }
    .log-line {
      padding: 0.15rem 0;
      white-space: pre-wrap;
      word-break: break-all;
    }
    .muted {
      color: #64748b;
    }
    .kv-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 0.75rem;
      margin-top: 0.75rem;
    }
    .kv-box {
      background: var(--mat-sys-surface-container-high);
      padding: 0.75rem 1rem;
      border-radius: 8px;
      border: 1px solid var(--mat-sys-outline-variant);
    }
    .kv-label {
      font-size: 0.75rem;
      color: var(--mat-sys-on-surface-variant);
      margin-bottom: 0.25rem;
    }
    .kv-val {
      font-size: 0.95rem;
      font-weight: 700;
      &.enabled {
        color: #10b981;
      }
      &.highlight {
        color: var(--mat-sys-primary);
      }
    }
    .card-table-content {
      padding: 0 1.25rem 1.25rem !important;
      overflow-x: auto;
    }
    .data-table {
      width: 100%;
      background: transparent;
    }
    .cat-title {
      font-weight: 700;
      color: var(--mat-sys-on-surface);
    }
    .url-cell {
      max-width: 320px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .store-link {
      color: var(--mat-sys-primary);
      text-decoration: none;
      font-size: 0.85rem;
      font-weight: 500;
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      &:hover { text-decoration: underline; }
    }
    .url-text {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .col-actions {
      width: 120px !important;
      text-align: right;
    }
    .row-actions {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
    }
  `],
})
export class ScrapingComponent {
  displayedColumns: string[] = ['categoryName', 'provider', 'url', 'withOffers', 'enabled', 'actions'];
  sortedPages: ScrapePageConfig[] = [];
  private lastPagesRef?: ScrapePageConfig[];

  constructor(
    private apiService: ApiService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {}

  ngDoCheck() {
    const pages = this.apiService.dashboardData()?.pages;
    if (pages !== this.lastPagesRef) {
      this.lastPagesRef = pages;
      this.sortedPages = pages ? [...pages] : [];
    }
  }

  isScraping(): boolean {
    return this.apiService.dashboardData()?.runner?.isScraping ?? false;
  }

  recentLogs(): string[] {
    return this.apiService.dashboardData()?.runner?.recentLogs || [];
  }

  scheduler() {
    return this.apiService.dashboardData()?.scheduler;
  }

  formatNextRun(dateStr?: string | null): string {
    if (!dateStr) return 'N/A';
    const nextDate = new Date(dateStr);
    if (isNaN(nextDate.getTime())) return 'N/A';

    const now = new Date();
    const isToday = nextDate.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = nextDate.toDateString() === tomorrow.toDateString();

    const timeStr = nextDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStrFormatted = nextDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

    if (isTomorrow) {
      return `Tomorrow (${dateStrFormatted}), ${timeStr}`;
    }
    if (isToday) {
      return `Today (${dateStrFormatted}), ${timeStr}`;
    }
    return `${dateStrFormatted}, ${timeStr}`;
  }

  scrapeAll(withOffers: boolean) {
    this.apiService.triggerScrape({ withOffers }).subscribe(() => {
      this.snackBar.open('Batch scrape triggered successfully!', 'OK', { duration: 3000 });
    });
  }

  scrapeSingle(page: ScrapePageConfig) {
    this.apiService.triggerScrape({ pageId: page.id }).subscribe(() => {
      this.snackBar.open(`Scrape triggered for ${page.categoryName}!`, 'OK', { duration: 3000 });
    });
  }

  rerollCron() {
    this.apiService.rerollScheduler().subscribe(() => {
      this.snackBar.open('Re-rolled daily randomized cron time!', 'OK', { duration: 3000 });
    });
  }

  openCronDialog() {
    const dialogRef = this.dialog.open(CronFormDialogComponent, {
      data: { scheduler: this.scheduler() },
      width: '500px',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.apiService.updateScheduler(result).subscribe(() => {
          this.snackBar.open('Cron schedule updated!', 'OK', { duration: 3000 });
        });
      }
    });
  }

  openAddPageDialog() {
    const dialogRef = this.dialog.open(PageFormDialogComponent, {
      data: {},
      width: '520px',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.apiService.addPage(result).subscribe(() => {
          this.snackBar.open('Page added successfully!', 'OK', { duration: 3000 });
        });
      }
    });
  }

  openEditPageDialog(page: ScrapePageConfig) {
    const dialogRef = this.dialog.open(PageFormDialogComponent, {
      data: { page },
      width: '520px',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.apiService.updatePage(page.id, result).subscribe(() => {
          this.snackBar.open('Page updated successfully!', 'OK', { duration: 3000 });
        });
      }
    });
  }

  toggleOffers(page: ScrapePageConfig, withOffers: boolean) {
    this.apiService.updatePage(page.id, { withOffers }).subscribe();
  }

  toggleEnabled(page: ScrapePageConfig, enabled: boolean) {
    this.apiService.updatePage(page.id, { enabled }).subscribe();
  }

  deletePage(page: ScrapePageConfig) {
    if (confirm(`Are you sure you want to delete ${page.categoryName}?`)) {
      this.apiService.deletePage(page.id).subscribe(() => {
        this.snackBar.open('Page deleted successfully!', 'OK', { duration: 3000 });
      });
    }
  }

  sortPages(sort: Sort) {
    const data = [...(this.apiService.dashboardData()?.pages || [])];
    if (!sort.active || sort.direction === '') {
      this.sortedPages = data;
      return;
    }

    this.sortedPages = data.sort((a, b) => {
      const isAsc = sort.direction === 'asc';
      switch (sort.active) {
        case 'categoryName': return compare(a.categoryName, b.categoryName, isAsc);
        case 'provider': return compare(a.provider, b.provider, isAsc);
        case 'url': return compare(a.url, b.url, isAsc);
        case 'withOffers': return compare(String(a.withOffers), String(b.withOffers), isAsc);
        case 'enabled': return compare(String(a.enabled), String(b.enabled), isAsc);
        default: return 0;
      }
    });
  }
}

function compare(a: number | string, b: number | string, isAsc: boolean) {
  return (a < b ? -1 : 1) * (isAsc ? 1 : -1);
}
