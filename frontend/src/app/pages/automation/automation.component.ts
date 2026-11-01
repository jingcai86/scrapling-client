import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../../core/services/api.service';
import type { ScrapePageConfig, SchedulerState } from '../../core/models/dashboard.model';
import { TargetFormDialogComponent } from '../../dialogs/target-form-dialog.component';
import { ScheduleFormDialogComponent } from '../../dialogs/schedule-form-dialog.component';
import {
  formatUtcBaseTimeToLocal,
  areSameScheduleIds,
  isDefaultScheduleId,
  resolveScheduleSelectValue,
} from '../../core/utils/time.utils';
import {
  CANONICAL_TARGET_URLS,
  CANONICAL_CATEGORY_URLS,
  getCanonicalTargetKey,
} from '../../core/utils/target.utils';

@Component({
  selector: 'app-automation',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatCardModule,
    MatTableModule,
    MatSortModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatSelectModule,
    MatFormFieldModule,
    MatDialogModule,
    MatSnackBarModule,
    MatTooltipModule,
  ],
  template: `
    <div class="page-container">
      <!-- Page Header -->
      <div class="page-header">
        <div class="header-titles">
          <h1>Automation</h1>
          <p class="subtitle">
            Manage daily randomized schedules, anti-bot jitter windows, and monitored marketplace targets.
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
          <button mat-stroked-button color="primary" (click)="openAddScheduleModal()">
            <mat-icon>add_alarm</mat-icon>
            <span>New Schedule</span>
          </button>
          <button mat-flat-button color="primary" (click)="openAddTargetModal()">
            <mat-icon>add</mat-icon>
            <span>Add Target</span>
          </button>
        </div>
      </div>

      <!-- 4 Clean SaaS KPI Cards -->
      <div class="kpi-grid">
        <mat-card class="kpi-card" appearance="outlined">
          <div class="kpi-top">
            <span class="kpi-label">Active Schedules</span>
            <span class="kpi-icon-box accent-indigo">
              <mat-icon>schedule</mat-icon>
            </span>
          </div>
          <div class="kpi-metric-row">
            <span class="kpi-value">{{ enabledSchedulesCount() }}</span>
            <span class="kpi-unit">/ {{ schedulers().length }} total</span>
          </div>
          <div class="kpi-sub">Randomized daily execution windows</div>
        </mat-card>

        <mat-card class="kpi-card" appearance="outlined">
          <div class="kpi-top">
            <span class="kpi-label">Earliest Next Run</span>
            <span class="kpi-icon-box accent-blue">
              <mat-icon>event_upcoming</mat-icon>
            </span>
          </div>
          <div class="kpi-metric-row">
            <span class="kpi-value kpi-value-md">{{ earliestNextRun() }}</span>
            <span class="kpi-pill pill-blue" *ngIf="earliestCountdown()">
              {{ earliestCountdown() }}
            </span>
          </div>
          <div class="kpi-sub">{{ earliestScheduleName() }}</div>
        </mat-card>

        <mat-card class="kpi-card" appearance="outlined">
          <div class="kpi-top">
            <span class="kpi-label">Monitored Targets</span>
            <span class="kpi-icon-box accent-emerald">
              <mat-icon>check_circle</mat-icon>
            </span>
          </div>
          <div class="kpi-metric-row">
            <span class="kpi-value">{{ enabledPagesCount() }}</span>
            <span class="kpi-unit">/ {{ pages().length }} enabled</span>
          </div>
          <div class="kpi-sub">Active Eneba &amp; G2A category pages</div>
        </mat-card>

        <mat-card class="kpi-card" appearance="outlined">
          <div class="kpi-top">
            <span class="kpi-label">Runner Status</span>
            <span class="kpi-icon-box accent-amber">
              <mat-icon>memory</mat-icon>
            </span>
          </div>
          <div class="kpi-metric-row">
            <span class="kpi-value kpi-value-md">
              {{ apiService.dashboardData()?.runner?.isScraping ? 'Running' : 'Idle' }}
            </span>
          </div>
          <div class="kpi-sub">
            {{ apiService.dashboardData()?.runner?.currentStep || 'Ready for manual or scheduled execution' }}
          </div>
        </mat-card>
      </div>

      <!-- Section 1: Daily Randomized Schedules -->
      <mat-card class="main-card" appearance="outlined">
        <mat-card-header class="table-header">
          <div>
            <mat-card-title>Schedules</mat-card-title>
            <mat-card-subtitle>
              Each schedule rolls a fresh randomized trigger timestamp every day inside its configured window.
            </mat-card-subtitle>
          </div>
          <button mat-stroked-button color="primary" (click)="openAddScheduleModal()">
            <mat-icon>add</mat-icon>
            <span>New Schedule</span>
          </button>
        </mat-card-header>

        <mat-card-content class="schedules-card-body">
          <div class="schedules-grid">
            <div
              *ngFor="let s of schedulers(); trackBy: trackByScheduleId"
              class="schedule-card"
              [class.is-disabled]="!s.enabled"
            >
              <div class="sched-card-header">
                <div class="sched-title-group">
                  <span class="status-dot" [class.active]="s.enabled"></span>
                  <span class="sched-name">{{ s.name || 'Primary Schedule' }}</span>
                  <span class="badge-tag" *ngIf="isDefaultSchedule(s)">Default</span>
                </div>

                <div class="sched-actions">
                  <button
                    mat-stroked-button
                    color="primary"
                    class="btn-compact"
                    (click)="runScheduleNow(s)"
                    [disabled]="apiService.dashboardData()?.runner?.isScraping"
                    matTooltip="Run all enabled targets in this schedule now"
                  >
                    <mat-icon>play_arrow</mat-icon>
                    <span>Run</span>
                  </button>
                  <button
                    mat-icon-button
                    class="icon-btn-sm"
                    (click)="rerollSchedule(s)"
                    matTooltip="Re-roll randomized next run time"
                  >
                    <mat-icon>casino</mat-icon>
                  </button>
                  <button
                    mat-icon-button
                    class="icon-btn-sm"
                    (click)="openEditScheduleModal(s)"
                    matTooltip="Edit schedule window"
                  >
                    <mat-icon>edit</mat-icon>
                  </button>
                  <button
                    *ngIf="!isDefaultSchedule(s)"
                    mat-icon-button
                    color="warn"
                    class="icon-btn-sm"
                    (click)="deleteSchedule(s)"
                    matTooltip="Delete schedule"
                  >
                    <mat-icon>delete_outline</mat-icon>
                  </button>
                </div>
              </div>

              <div class="sched-metrics-grid">
                <div class="sched-metric">
                  <span class="metric-label">Daily Window ({{ apiService.getTimeZone() }})</span>
                  <span class="metric-val">
                    {{ formatLocalBaseTime(s.baseTime) }}
                    <span class="metric-muted">+ 0..{{ s.jitterMinutes }}m</span>
                  </span>
                </div>
                <div class="sched-metric">
                  <span class="metric-label">Next Scheduled Run</span>
                  <span class="metric-val accent-primary" *ngIf="s.enabled; else disabledTpl">
                    {{ formatNextRun(s.nextRunAt) }}
                  </span>
                  <ng-template #disabledTpl>
                    <span class="metric-val metric-muted">Paused</span>
                  </ng-template>
                </div>
                <div class="sched-metric">
                  <span class="metric-label">Last Execution</span>
                  <span class="metric-val">{{ formatLastRun(s) }}</span>
                </div>
              </div>

              <div class="sched-targets-footer">
                <span class="targets-count-label">
                  Assigned Targets ({{ getPagesForSchedule(s.id).length }})
                </span>
                <div class="assigned-chips" *ngIf="getPagesForSchedule(s.id).length > 0; else noAssignedTpl">
                  <span
                    class="target-chip"
                    *ngFor="let p of getPagesForSchedule(s.id)"
                    [class.chip-disabled]="!p.enabled"
                  >
                    <span class="chip-prov">{{ getProviderDisplayName(p.provider || p.category) }}</span>
                    <span>{{ p.categoryName || p.name }}</span>
                  </span>
                </div>
                <ng-template #noAssignedTpl>
                  <span class="no-targets-hint">No targets assigned to this schedule.</span>
                </ng-template>
              </div>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Section 2: Monitored Scrape Targets Table -->
      <mat-card class="main-card" appearance="outlined">
        <mat-card-header class="table-header">
          <div>
            <mat-card-title>Monitored Scrape Targets</mat-card-title>
            <mat-card-subtitle>
              Configure target URLs, toggle seller offer extraction, and assign each target to a schedule.
            </mat-card-subtitle>
          </div>
          <div class="header-actions">
            <button
              mat-stroked-button
              (click)="triggerAll()"
              [disabled]="apiService.dashboardData()?.runner?.isScraping"
            >
              <mat-icon>play_arrow</mat-icon>
              <span>Run All Enabled</span>
            </button>
            <button mat-flat-button color="primary" (click)="openAddTargetModal()">
              <mat-icon>add</mat-icon>
              <span>Add Target</span>
            </button>
          </div>
        </mat-card-header>

        <mat-card-content class="card-table-content">
          <div class="table-wrapper">
            <table
              mat-table
              [dataSource]="sortedPages()"
              matSort
              (matSortChange)="sortData($event)"
              [trackBy]="trackByPageId"
              class="data-table"
            >
              <ng-container matColumnDef="enabled">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Active</th>
                <td mat-cell *matCellDef="let page">
                  <mat-checkbox
                    [checked]="page.enabled"
                    (change)="togglePageEnabled(page, $event.checked)"
                    color="primary"
                  ></mat-checkbox>
                </td>
              </ng-container>

              <ng-container matColumnDef="provider">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Marketplace</th>
                <td mat-cell *matCellDef="let page">
                  <a
                    [routerLink]="['/', (page.provider || page.category || 'eneba').toLowerCase()]"
                    class="provider-badge"
                    [attr.data-provider]="(page.provider || page.category || 'eneba').toLowerCase()"
                  >
                    {{ getProviderDisplayName(page.provider || page.category) }}
                  </a>
                </td>
              </ng-container>

              <ng-container matColumnDef="categoryName">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Target Name</th>
                <td mat-cell *matCellDef="let page">
                  <div class="target-name-cell">
                    <span class="target-title">{{ page.categoryName || page.name }}</span>
                    <a
                      [href]="getTargetStoreUrl(page)"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="target-url-sub"
                    >
                      {{ getTargetStoreUrl(page) }}
                    </a>
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="schedule">
                <th mat-header-cell *matHeaderCellDef>Assigned Schedule</th>
                <td mat-cell *matCellDef="let page">
                  <mat-form-field
                    appearance="outline"
                    class="inline-schedule-select"
                    subscriptSizing="dynamic"
                  >
                    <mat-select
                      [ngModel]="resolveScheduleValue(page.scheduleId)"
                      (selectionChange)="assignSchedule(page, $event.value)"
                    >
                      <mat-option *ngFor="let s of schedulers(); trackBy: trackByScheduleId" [value]="s.id">
                        {{ s.name || 'Primary Schedule' }} ({{ formatLocalBaseTime(s.baseTime) }})
                      </mat-option>
                    </mat-select>
                  </mat-form-field>
                </td>
              </ng-container>

              <ng-container matColumnDef="withOffers">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Seller Offers</th>
                <td mat-cell *matCellDef="let page">
                  <mat-checkbox
                    [checked]="page.withOffers !== false"
                    (change)="togglePageOffers(page, $event.checked)"
                    color="primary"
                  >
                    <span class="checkbox-sub">{{ page.withOffers !== false ? 'Enabled' : 'Off' }}</span>
                  </mat-checkbox>
                </td>
              </ng-container>

              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef class="col-actions">Actions</th>
                <td mat-cell *matCellDef="let page" class="col-actions">
                  <div class="row-actions">
                    <button
                      mat-stroked-button
                      color="primary"
                      class="btn-compact"
                      (click)="scrapeSingle(page.id)"
                      [disabled]="apiService.dashboardData()?.runner?.isScraping"
                    >
                      <mat-icon>play_arrow</mat-icon>
                      <span>Scrape</span>
                    </button>
                    <button
                      mat-icon-button
                      class="icon-btn-sm"
                      (click)="openEditTargetModal(page)"
                      matTooltip="Edit target"
                    >
                      <mat-icon>edit</mat-icon>
                    </button>
                    <button
                      mat-icon-button
                      color="warn"
                      class="icon-btn-sm"
                      (click)="deletePage(page)"
                      matTooltip="Delete target"
                    >
                      <mat-icon>delete_outline</mat-icon>
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
  styleUrl: './automation.component.scss',
})
export class AutomationComponent {
  displayedColumns: string[] = [
    'enabled',
    'provider',
    'categoryName',
    'schedule',
    'withOffers',
    'actions',
  ];

  private sortState = signal<Sort>({ active: '', direction: '' });

  readonly pages = computed<ScrapePageConfig[]>(() => {
    return this.apiService.dashboardData()?.pages || [];
  });

  readonly schedulers = computed<SchedulerState[]>(() => {
    const data = this.apiService.dashboardData();
    if (data?.schedulers && data.schedulers.length > 0) {
      return data.schedulers;
    }
    if (data?.scheduler) {
      return [data.scheduler];
    }
    return [];
  });

  readonly sortedPages = computed<ScrapePageConfig[]>(() => {
    const data = [...this.pages()];
    const sort = this.sortState();
    if (!sort.active || sort.direction === '') {
      return data;
    }
    const isAsc = sort.direction === 'asc';
    return data.sort((a, b) => {
      switch (sort.active) {
        case 'enabled':
          return (a.enabled === b.enabled ? 0 : a.enabled ? -1 : 1) * (isAsc ? 1 : -1);
        case 'provider':
          return this.compare(
            this.getProviderDisplayName(a.provider || a.category),
            this.getProviderDisplayName(b.provider || b.category),
            isAsc,
          );
        case 'categoryName':
          return this.compare(a.categoryName || a.name || '', b.categoryName || b.name || '', isAsc);
        case 'withOffers':
          return (
            ((a.withOffers !== false) === (b.withOffers !== false)
              ? 0
              : a.withOffers !== false
                ? -1
                : 1) * (isAsc ? 1 : -1)
          );
        default:
          return 0;
      }
    });
  });

  constructor(
    public apiService: ApiService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {}

  trackByScheduleId(_index: number, item: SchedulerState): string {
    return item.id || 'default';
  }

  trackByPageId(_index: number, item: ScrapePageConfig): string {
    return item.id;
  }

  isDefaultSchedule(s: SchedulerState): boolean {
    return Boolean(s.isDefault || isDefaultScheduleId(s.id));
  }

  resolveScheduleValue(scheduleId?: string): string {
    return resolveScheduleSelectValue(scheduleId, this.schedulers());
  }

  getProviderDisplayName(provider?: string | null): string {
    if (!provider) return 'Eneba';
    const lower = provider.toLowerCase().trim();
    if (lower === 'g2a') return 'G2A';
    if (lower === 'eneba') return 'Eneba';
    return provider.charAt(0).toUpperCase() + provider.slice(1);
  }

  getTargetStoreUrl(page: ScrapePageConfig): string {
    const id = (page.id || '').trim();
    if (id && CANONICAL_TARGET_URLS[id]) {
      return CANONICAL_TARGET_URLS[id];
    }
    const key = getCanonicalTargetKey(page);
    if (key && CANONICAL_CATEGORY_URLS[key]) {
      return CANONICAL_CATEGORY_URLS[key];
    }
    return page.url;
  }

  enabledPagesCount(): number {
    return this.pages().filter((p) => p.enabled).length;
  }

  enabledSchedulesCount(): number {
    return this.schedulers().filter((s) => s.enabled).length;
  }

  private getEarliestActiveSchedule(): SchedulerState | undefined {
    const active = this.schedulers().filter(
      (s) => s.enabled && s.nextRunAt && !isNaN(new Date(s.nextRunAt).getTime()),
    );
    if (active.length === 0) return undefined;
    return [...active].sort(
      (a, b) => new Date(a.nextRunAt!).getTime() - new Date(b.nextRunAt!).getTime(),
    )[0];
  }

  earliestNextRun(): string {
    const s = this.getEarliestActiveSchedule();
    if (!s?.nextRunAt) return 'None Scheduled';
    return this.formatNextRun(s.nextRunAt);
  }

  earliestCountdown(): string {
    const s = this.getEarliestActiveSchedule();
    if (!s?.nextRunAt) return '';
    const diffMs = new Date(s.nextRunAt).getTime() - Date.now();
    if (diffMs <= 0) return 'Soon';
    const mins = Math.floor(diffMs / 60000);
    const hours = Math.floor(mins / 60);
    if (hours > 0) return `in ${hours}h ${mins % 60}m`;
    return `in ${mins}m`;
  }

  earliestScheduleName(): string {
    const s = this.getEarliestActiveSchedule();
    if (!s) return 'All schedules paused';
    const localBase = this.formatLocalBaseTime(s.baseTime);
    return `${s.name || 'Primary Schedule'} · Base ${localBase} (+0..${s.jitterMinutes}m)`;
  }

  getPagesForSchedule(scheduleId?: string): ScrapePageConfig[] {
    return this.pages().filter((p) => areSameScheduleIds(p.scheduleId, scheduleId));
  }

  formatLocalBaseTime(utcBaseTime?: string): string {
    return formatUtcBaseTimeToLocal(utcBaseTime || '02:00', this.apiService.getTimeZone());
  }

  formatNextRun(dateStr?: string | null): string {
    if (!dateStr) return 'Pending';
    const d = new Date(dateStr);
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

  formatLastRun(s: SchedulerState): string {
    if (s.lastRunAt) {
      const d = new Date(s.lastRunAt);
      if (!isNaN(d.getTime())) {
        return d.toLocaleString([], {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        });
      }
    }

    const assignedPages = this.getPagesForSchedule(s.id);
    if (assignedPages.length === 0) {
      return 'No targets assigned';
    }

    const assignedIds = new Set(assignedPages.map((p) => p.id));
    const statuses = this.apiService.dashboardData()?.statuses || [];
    let latestMs = 0;

    for (const st of statuses) {
      const stId = (st.scrapeTargetId || st.targetId || '').trim();
      if (stId && assignedIds.has(stId) && st.scrapedAt) {
        const t = new Date(st.scrapedAt).getTime();
        if (!isNaN(t) && t > latestMs) {
          latestMs = t;
        }
      }
    }

    if (latestMs > 0) {
      return new Date(latestMs).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    }

    return 'Never run';
  }

  sortData(sort: Sort): void {
    this.sortState.set(sort);
  }

  private compare(a: number | string, b: number | string, isAsc: boolean): number {
    return (a < b ? -1 : 1) * (isAsc ? 1 : -1);
  }

  openAddScheduleModal(): void {
    const dialogRef = this.dialog.open(ScheduleFormDialogComponent, {
      data: { isNew: true, timeZone: this.apiService.getTimeZone() },
      width: '500px',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.apiService.createScheduler(result).subscribe(() => {
          this.snackBar.open(`Created schedule "${result.name}"`, 'OK', { duration: 3000 });
        });
      }
    });
  }

  openEditScheduleModal(s: SchedulerState): void {
    const dialogRef = this.dialog.open(ScheduleFormDialogComponent, {
      data: { scheduler: s, isNew: false, timeZone: this.apiService.getTimeZone() },
      width: '500px',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        const id = s.id || 'default';
        this.apiService.updateScheduleItem(id, result).subscribe(() => {
          this.snackBar.open(`Updated schedule "${result.name}"`, 'OK', { duration: 3000 });
        });
      }
    });
  }

  rerollSchedule(s: SchedulerState): void {
    const id = s.id || 'default';
    this.apiService.rerollSchedule(id).subscribe(() => {
      this.snackBar.open(`Re-rolled next run window for "${s.name || 'Schedule'}"`, 'OK', {
        duration: 3000,
      });
    });
  }

  runScheduleNow(s: SchedulerState): void {
    const id = s.id || 'default';
    this.apiService.runSchedule(id).subscribe({
      next: () => {
        this.snackBar.open(`Started scrape for schedule "${s.name || 'Schedule'}"`, 'OK', {
          duration: 3000,
        });
      },
      error: (err) => {
        this.snackBar.open(
          err?.error?.error || 'No enabled targets assigned to this schedule',
          'Close',
          { duration: 4000 },
        );
      },
    });
  }

  deleteSchedule(s: SchedulerState): void {
    if (!s.id || this.isDefaultSchedule(s)) return;
    this.apiService.deleteSchedule(s.id).subscribe(() => {
      this.snackBar.open(
        `Deleted schedule "${s.name}". Assigned targets moved to Primary Schedule.`,
        'OK',
        { duration: 3500 },
      );
    });
  }

  assignSchedule(page: ScrapePageConfig, scheduleId: string): void {
    this.apiService.assignTargetSchedule(page.id, scheduleId).subscribe(() => {
      this.snackBar.open(`Assigned "${page.categoryName || page.name}" to schedule`, 'OK', {
        duration: 2500,
      });
    });
  }

  openAddTargetModal(): void {
    const dialogRef = this.dialog.open(TargetFormDialogComponent, {
      data: {},
      width: '520px',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.apiService.addTarget(result).subscribe(() => {
          this.snackBar.open(`Added target "${result.categoryName}"`, 'OK', { duration: 3000 });
        });
      }
    });
  }

  openEditTargetModal(page: ScrapePageConfig): void {
    const dialogRef = this.dialog.open(TargetFormDialogComponent, {
      data: { page },
      width: '520px',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.apiService.updateTarget(page.id, result).subscribe(() => {
          this.snackBar.open(`Updated target "${result.categoryName}"`, 'OK', { duration: 3000 });
        });
      }
    });
  }

  togglePageEnabled(page: ScrapePageConfig, enabled: boolean): void {
    this.apiService.updateTarget(page.id, { enabled }).subscribe(() => {
      this.snackBar.open(
        `${page.categoryName || page.name} ${enabled ? 'enabled' : 'disabled'}`,
        'OK',
        { duration: 2000 },
      );
    });
  }

  togglePageOffers(page: ScrapePageConfig, withOffers: boolean): void {
    this.apiService.updateTarget(page.id, { withOffers }).subscribe(() => {
      this.snackBar.open(
        `Seller offers ${withOffers ? 'enabled' : 'disabled'} for ${page.categoryName || page.name}`,
        'OK',
        { duration: 2000 },
      );
    });
  }

  scrapeSingle(pageId: string): void {
    this.apiService.triggerScrape({ pageId }).subscribe(() => {
      this.snackBar.open('Started single-target scrape', 'OK', { duration: 3000 });
    });
  }

  triggerAll(): void {
    this.apiService.triggerScrape({}).subscribe(() => {
      this.snackBar.open('Started scrape for all enabled targets', 'OK', { duration: 3000 });
    });
  }

  deletePage(page: ScrapePageConfig): void {
    this.apiService.deleteTarget(page.id).subscribe(() => {
      this.snackBar.open(`Deleted target "${page.categoryName || page.name}"`, 'OK', {
        duration: 3000,
      });
    });
  }
}
