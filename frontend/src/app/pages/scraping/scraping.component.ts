import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { ApiService } from '../../core/services/api.service';
import { PageFormDialogComponent } from '../../dialogs/page-form-dialog.component';
import { CronFormDialogComponent } from '../../dialogs/cron-form-dialog.component';
import type { ScrapePageConfig, SchedulerState } from '../../core/models/dashboard.model';

@Component({
  selector: 'app-scraping',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatTableModule,
    MatSortModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatSnackBarModule,
    MatSlideToggleModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSelectModule,
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
            <button mat-flat-button color="primary" (click)="scrapeAll()" [disabled]="isScraping()">
              ▶ Run All Enabled Scrapes
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

      <!-- 2. Schedulers Section (Array of Independent Schedules) -->
      <mat-card class="main-card" appearance="outlined">
        <mat-card-header class="card-header-flex">
          <mat-card-title>Scraping Schedulers &amp; Daily Automation</mat-card-title>
          <mat-card-subtitle>
            Manage multiple independent daily randomized cron schedules. Each scraping page can follow its own schedule.
          </mat-card-subtitle>
          <div class="action-buttons">
            <button mat-flat-button color="primary" (click)="openCreateScheduleDialog()">
              + Create Schedule
            </button>
          </div>
        </mat-card-header>
        <mat-card-content>
          <div class="schedules-grid">
            <div *ngFor="let s of schedulers(); trackBy: trackBySchedId" class="schedule-card">
              <div class="schedule-card-header">
                <div class="schedule-meta">
                  <strong class="schedule-name">{{ s.name || 'Schedule ' + s.id }}</strong>
                  <span class="badge" [class.badge-active]="s.enabled" [class.badge-muted]="!s.enabled">
                    {{ s.enabled ? 'Active' : 'Disabled' }}
                  </span>
                  <span *ngIf="s.id === 'default'" class="default-pill">Default</span>
                </div>
                <div class="schedule-actions">
                  <button mat-icon-button (click)="rerollSchedule(s)" matTooltip="Re-roll randomized time" aria-label="Re-roll time">
                    <mat-icon>casino</mat-icon>
                  </button>
                  <button mat-icon-button (click)="openEditScheduleDialog(s)" matTooltip="Edit schedule" aria-label="Edit schedule">
                    <mat-icon>edit</mat-icon>
                  </button>
                  <button mat-icon-button color="primary" (click)="runSchedule(s)" [disabled]="isScraping()" matTooltip="Run assigned pages now" aria-label="Run now">
                    <mat-icon>play_arrow</mat-icon>
                  </button>
                  <button *ngIf="s.id !== 'default'" mat-icon-button color="warn" (click)="deleteSchedule(s)" matTooltip="Delete schedule" aria-label="Delete schedule">
                    <mat-icon>delete</mat-icon>
                  </button>
                </div>
              </div>

              <div class="schedule-telemetry">
                <div class="telemetry-box">
                  <span class="telemetry-label">Daily Window:</span>
                  <span class="telemetry-val">{{ s.baseTime || '19:00' }} + 0..{{ s.jitterMinutes || 60 }}m</span>
                </div>
                <div class="telemetry-box">
                  <span class="telemetry-label">Next Run:</span>
                  <span class="telemetry-val highlight">{{ formatNextRun(s.nextRunAt) }}</span>
                </div>
                <div class="telemetry-box">
                  <span class="telemetry-label">Last Run:</span>
                  <span class="telemetry-val">{{ formatNextRun(s.lastRunAt) }}</span>
                </div>
              </div>

              <!-- Assigned Target Pages for this Schedule -->
              <div class="assigned-pages-box">
                <div class="assigned-title-row">
                  <span class="assigned-label">Assigned Pages ({{ getPagesForSchedule(s.id).length }}):</span>
                </div>
                <div class="page-chips-wrap">
                  <span *ngFor="let p of getPagesForSchedule(s.id)" class="page-chip">
                    {{ p.categoryName }}
                  </span>
                  <span *ngIf="getPagesForSchedule(s.id).length === 0" class="no-pages-hint">
                    No pages assigned. Runs will be skipped until assigned.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- 3. Target Scraping Pages Table -->
      <mat-card class="main-card" appearance="outlined">
        <mat-card-header class="card-header-flex">
          <mat-card-title>Target Scraping Pages</mat-card-title>
          <mat-card-subtitle>
            Click any column header to sort. Manage store URLs and configure which schedule each page follows.
          </mat-card-subtitle>
          <button mat-flat-button color="primary" (click)="openAddPageDialog()">
            + Add Scraping Page
          </button>
        </mat-card-header>
        <mat-card-content class="card-table-content table-wrapper-relative">
          <!-- Loading State Overlay -->
          <div *ngIf="isLoading" class="ui-loading-overlay">
            <mat-spinner diameter="36" strokeWidth="3"></mat-spinner>
            <span class="loading-label">Loading target scraping pages...</span>
          </div>

          <div class="table-wrapper" [class.table-loading-dimmed]="isLoading">
            <table mat-table [dataSource]="sortedPages" matSort (matSortChange)="sortPages($event)" class="data-table">
              <ng-container matColumnDef="categoryName">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Target Name / Product</th>
                <td mat-cell *matCellDef="let page">
                  <strong class="cat-title">{{ page.categoryName || page.name }}</strong>
                  <span *ngIf="page.productSlug" class="badge" style="margin-left: 6px; font-size: 0.72rem; opacity: 0.85;">
                    {{ page.productSlug }}
                  </span>
                </td>
              </ng-container>

              <ng-container matColumnDef="provider">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Provider</th>
                <td mat-cell *matCellDef="let page">
                  <span class="badge badge-provider">{{ page.provider }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="url">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Product / Store URL</th>
                <td mat-cell *matCellDef="let page" class="url-cell">
                  <a *ngIf="page.url" [href]="page.url" target="_blank" rel="noopener" class="store-link" [title]="page.url">
                    <span class="url-text">{{ page.url }}</span> ↗
                  </a>
                  <span *ngIf="!page.url" class="muted">No URL linked</span>
                </td>
              </ng-container>

              <!-- Schedule Assignment Column -->
              <ng-container matColumnDef="scheduleId">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Assigned Schedule</th>
                <td mat-cell *matCellDef="let page" class="schedule-cell">
                  <mat-form-field appearance="outline" class="table-schedule-field" subscriptSizing="dynamic">
                    <mat-select
                      [value]="page.scheduleId || 'default'"
                      (selectionChange)="onPageScheduleChange(page, $event.value)"
                      aria-label="Assign schedule"
                    >
                      <mat-option *ngFor="let s of schedulers()" [value]="s.id">
                        {{ s.name || s.id }} ({{ s.baseTime }})
                      </mat-option>
                    </mat-select>
                  </mat-form-field>
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
    .schedules-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
      gap: 1rem;
      margin-top: 0.75rem;
    }
    .schedule-card {
      background: var(--mat-sys-surface-container-high);
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 10px;
      padding: 1rem 1.15rem;
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
    }
    .schedule-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
    }
    .schedule-meta {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      flex-wrap: wrap;
    }
    .schedule-name {
      font-size: 1.02rem;
      font-weight: 700;
      color: var(--mat-sys-on-surface);
    }
    .schedule-actions {
      display: flex;
      align-items: center;
      gap: 0.15rem;
    }
    .badge-active {
      background: rgba(16, 185, 129, 0.15) !important;
      color: #10b981 !important;
      border: 1px solid rgba(16, 185, 129, 0.3) !important;
      font-weight: 700;
      font-size: 0.72rem;
      padding: 0.15rem 0.45rem;
      border-radius: 9999px;
    }
    .badge-muted {
      background: rgba(148, 163, 184, 0.15) !important;
      color: #94a3b8 !important;
      border: 1px solid rgba(148, 163, 184, 0.3) !important;
      font-weight: 700;
      font-size: 0.72rem;
      padding: 0.15rem 0.45rem;
      border-radius: 9999px;
    }
    .default-pill {
      background: rgba(99, 102, 241, 0.15);
      color: #818cf8;
      border: 1px solid rgba(99, 102, 241, 0.3);
      font-size: 0.7rem;
      font-weight: 700;
      padding: 0.1rem 0.45rem;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .schedule-telemetry {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      background: var(--mat-sys-surface-container);
      padding: 0.65rem 0.85rem;
      border-radius: 8px;
      border: 1px solid var(--mat-sys-outline-variant);
    }
    .telemetry-box {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.84rem;
    }
    .telemetry-label {
      color: var(--mat-sys-on-surface-variant);
      font-weight: 500;
    }
    .telemetry-val {
      font-weight: 700;
      color: var(--mat-sys-on-surface);
      &.highlight {
        color: var(--mat-sys-primary);
      }
    }
    .assigned-pages-box {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    .assigned-label {
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--mat-sys-on-surface-variant);
    }
    .page-chips-wrap {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
    }
    .page-chip {
      background: var(--mat-sys-surface-container-highest);
      color: var(--mat-sys-on-surface);
      border: 1px solid var(--mat-sys-outline-variant);
      padding: 0.2rem 0.55rem;
      border-radius: 6px;
      font-size: 0.76rem;
      font-weight: 600;
    }
    .no-pages-hint {
      font-size: 0.78rem;
      color: var(--mat-sys-outline);
      font-style: italic;
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
      max-width: 240px;
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
    .schedule-cell {
      min-width: 170px;
    }
    .table-schedule-field {
      width: 100%;
      font-size: 0.82rem;
    }
    ::ng-deep .table-schedule-field .mat-mdc-text-field-wrapper {
      padding: 0 0.5rem !important;
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
  displayedColumns: string[] = ['categoryName', 'provider', 'url', 'scheduleId', 'enabled', 'actions'];
  sortedPages: ScrapePageConfig[] = [];
  private lastPagesRef?: ScrapePageConfig[];

  constructor(
    private apiService: ApiService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {}

  get isLoading(): boolean {
    return this.apiService.isLoading() || !this.apiService.dashboardData();
  }

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

  schedulers(): SchedulerState[] {
    const data = this.apiService.dashboardData();
    if (data?.schedulers && data.schedulers.length > 0) {
      return data.schedulers;
    }
    if (data?.scheduler) {
      return [data.scheduler];
    }
    return [];
  }

  getPagesForSchedule(scheduleId?: string): ScrapePageConfig[] {
    const targetId = scheduleId || 'default';
    const pages = this.apiService.dashboardData()?.pages || [];
    return pages.filter((p) => (p.scheduleId || 'default') === targetId);
  }

  trackBySchedId(_index: number, item: SchedulerState): string {
    return item.id || 'default';
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
      return `Tomorrow, ${timeStr}`;
    }
    if (isToday) {
      return `Today, ${timeStr}`;
    }
    return `${dateStrFormatted}, ${timeStr}`;
  }

  scrapeAll() {
    this.apiService.triggerScrape({}).subscribe(() => {
      this.snackBar.open('Batch scrape triggered successfully!', 'OK', { duration: 3000 });
    });
  }

  scrapeSingle(page: ScrapePageConfig) {
    this.apiService.triggerScrape({ pageId: page.id }).subscribe(() => {
      this.snackBar.open(`Scrape triggered for ${page.categoryName}!`, 'OK', { duration: 3000 });
    });
  }

  runSchedule(s: SchedulerState) {
    const id = s.id || 'default';
    this.apiService.runSchedule(id).subscribe({
      next: (res) => {
        this.snackBar.open(`Scrape completed for ${res.scrapedCount} page(s) in schedule "${s.name || id}"!`, 'OK', { duration: 3500 });
      },
      error: (err) => {
        this.snackBar.open(`Failed to run schedule: ${err.error?.error || err.message}`, 'OK', { duration: 4000 });
      },
    });
  }

  rerollSchedule(s: SchedulerState) {
    const id = s.id || 'default';
    this.apiService.rerollSchedule(id).subscribe(() => {
      this.snackBar.open(`Re-rolled randomized time for "${s.name || id}"!`, 'OK', { duration: 3000 });
    });
  }

  openCreateScheduleDialog() {
    const dialogRef = this.dialog.open(CronFormDialogComponent, {
      data: { isNew: true },
      width: '520px',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.apiService.createScheduler(result).subscribe(() => {
          this.snackBar.open('Created new scraping schedule!', 'OK', { duration: 3000 });
        });
      }
    });
  }

  openEditScheduleDialog(s: SchedulerState) {
    const id = s.id || 'default';
    const dialogRef = this.dialog.open(CronFormDialogComponent, {
      data: { scheduler: s, isNew: false },
      width: '520px',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.apiService.updateScheduleItem(id, result).subscribe(() => {
          this.snackBar.open(`Updated schedule "${result.name || id}"!`, 'OK', { duration: 3000 });
        });
      }
    });
  }

  deleteSchedule(s: SchedulerState) {
    const id = s.id || 'default';
    if (confirm(`Are you sure you want to delete schedule "${s.name || id}"? All assigned pages will revert to the default schedule.`)) {
      this.apiService.deleteSchedule(id).subscribe(() => {
        this.snackBar.open(`Deleted schedule "${s.name || id}".`, 'OK', { duration: 3000 });
      });
    }
  }

  onPageScheduleChange(page: ScrapePageConfig, scheduleId: string) {
    this.apiService.assignPageSchedule(page.id, scheduleId).subscribe(() => {
      this.snackBar.open(`Assigned ${page.categoryName} to selected schedule.`, 'OK', { duration: 2500 });
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
        case 'categoryName': return compare(a.categoryName || '', b.categoryName || '', isAsc);
        case 'provider': return compare(a.provider, b.provider, isAsc);
        case 'url': return compare(a.url, b.url, isAsc);
        case 'scheduleId': return compare(a.scheduleId || 'default', b.scheduleId || 'default', isAsc);
        case 'enabled': return compare(String(a.enabled), String(b.enabled), isAsc);
        default: return 0;
      }
    });
  }
}

function compare(a: number | string, b: number | string, isAsc: boolean) {
  return (a < b ? -1 : 1) * (isAsc ? 1 : -1);
}
