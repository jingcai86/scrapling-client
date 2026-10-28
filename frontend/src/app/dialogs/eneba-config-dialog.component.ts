import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDividerModule } from '@angular/material/divider';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import type { ScrapePageConfig, SchedulerState } from '../core/models/dashboard.model';

export interface EnebaConfigDialogData {
  providerDisplayName?: string;
  topDealsLimit: number;
  alertThresholdPct: number;
  pages?: ScrapePageConfig[];
  schedulers?: SchedulerState[];
}

export interface EnebaConfigDialogResult {
  topDealsLimit: number;
  alertThresholdPct: number;
  pageSchedules: Record<string, string>;
}

@Component({
  selector: 'app-eneba-config-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDividerModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
  ],
  template: `
    <div class="dialog-header">
      <div class="header-left">
        <h2 mat-dialog-title class="dialog-title">
          <span>⚙️ {{ providerTitle }} Store &amp; Schedule Configuration</span>
        </h2>
        <p class="dialog-subtitle">
          Configure deal limits, alert thresholds, and assign scraping schedules across monitored {{ providerTitle }} categories.
        </p>
      </div>
      <button mat-icon-button mat-dialog-close aria-label="Close dialog">
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <form (ngSubmit)="save()" class="config-form">
      <div mat-dialog-content class="form-content">
        <!-- Section 1: Provider Limits & Alerts -->
        <div class="section-title-row">
          <mat-icon class="section-icon">tune</mat-icon>
          <span class="section-heading">Provider Scraper Limits &amp; Alert Threshold</span>
        </div>

        <div class="field-container">
          <mat-form-field appearance="outline" class="full-width" subscriptSizing="dynamic">
            <mat-label>Pull Limit (Top Deals per Category)</mat-label>
            <input
              matInput
              type="number"
              [(ngModel)]="topDealsLimit"
              name="topDealsLimit"
              min="1"
              max="50"
              required
            />
            <mat-hint>Top-ranked deals to persist in PostgreSQL per category (1–50)</mat-hint>
          </mat-form-field>
        </div>

        <div class="field-container">
          <mat-form-field appearance="outline" class="full-width" subscriptSizing="dynamic">
            <mat-label>Alert Threshold (%)</mat-label>
            <input
              matInput
              type="number"
              [(ngModel)]="alertThresholdPct"
              name="alertThresholdPct"
              min="0"
              max="100"
              required
            />
            <mat-hint>Minimum discount percentage required to trigger alert emails (0–100%)</mat-hint>
          </mat-form-field>
        </div>

        <!-- Section 2: Category Scraping Schedules -->
        <mat-divider class="section-divider"></mat-divider>

        <div class="section-title-row header-with-action">
          <div class="heading-left">
            <mat-icon class="section-icon">calendar_month</mat-icon>
            <span class="section-heading">Category Scraping Schedules</span>
          </div>
          <a
            mat-button
            color="primary"
            class="manage-scheds-link"
            routerLink="/schedulers"
            (click)="dialogRef.close()"
          >
            <mat-icon class="btn-icon-sm">open_in_new</mat-icon>
            <span>Manage Schedulers</span>
          </a>
        </div>
        <p class="section-description">
          Each category can follow an independent schedule (e.g. some every few hours, others once daily).
        </p>

        <div class="category-sched-list" *ngIf="categoryPages.length > 0; else noPagesTpl">
          <div class="category-sched-row" *ngFor="let page of categoryPages">
            <div class="category-meta">
              <span class="category-name">{{ page.categoryName }}</span>
              <span class="category-id-badge">{{ page.id }}</span>
            </div>
            <mat-form-field appearance="outline" class="sched-select-field" subscriptSizing="dynamic">
              <mat-label>Assigned Schedule</mat-label>
              <mat-select [(ngModel)]="pageSchedules[page.id]" [name]="'sched_' + page.id">
                <mat-option *ngFor="let sch of schedulers" [value]="sch.id || 'default'">
                  <div class="option-row">
                    <span class="option-name">{{ sch.name || sch.id || 'default' }}</span>
                    <span class="option-sub">{{ sch.baseTime }} (+0..{{ sch.jitterMinutes }}m)</span>
                  </div>
                </mat-option>
              </mat-select>
            </mat-form-field>
          </div>
        </div>

        <ng-template #noPagesTpl>
          <div class="empty-pages-notice">
            <mat-icon>info</mat-icon>
            <span>No Eneba category pages found. You can add or configure pages in Schedulers.</span>
          </div>
        </ng-template>
      </div>

      <div mat-dialog-actions align="end" class="actions-bar">
        <button mat-button type="button" mat-dialog-close>Cancel</button>
        <button mat-flat-button color="primary" type="submit">
          Save Configuration
        </button>
      </div>
    </form>
  `,
  styles: [`
    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 1.25rem 1.5rem 0.5rem;
    }
    .header-left {
      flex: 1;
    }
    .dialog-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 1.18rem;
      font-weight: 700;
      margin: 0;
      padding: 0;
    }
    .dialog-subtitle {
      font-size: 0.85rem;
      color: var(--mat-sys-on-surface-variant);
      margin: 0.35rem 0 0;
      line-height: 1.4;
    }
    .config-form {
      display: flex;
      flex-direction: column;
    }
    .form-content {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      padding: 1rem 1.75rem 0.75rem !important;
      overflow-y: auto !important;
      max-height: 72vh;
    }
    .section-title-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-top: 0.25rem;

      &.header-with-action {
        justify-content: space-between;
      }
    }
    .heading-left {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .section-icon {
      font-size: 1.15rem;
      width: 1.15rem;
      height: 1.15rem;
      color: var(--mat-sys-primary);
    }
    .section-heading {
      font-size: 0.95rem;
      font-weight: 700;
      color: var(--mat-sys-on-surface);
    }
    .section-description {
      font-size: 0.82rem;
      color: var(--mat-sys-on-surface-variant);
      margin: -0.5rem 0 0;
      line-height: 1.35;
    }
    .manage-scheds-link {
      font-size: 0.78rem !important;
      height: 28px !important;
      padding: 0 0.5rem !important;

      .btn-icon-sm {
        font-size: 15px !important;
        width: 15px !important;
        height: 15px !important;
        margin-right: 2px !important;
      }
    }
    .section-divider {
      margin: 0.5rem 0 0.25rem;
      border-color: var(--mat-sys-outline-variant, rgba(255, 255, 255, 0.08));
    }
    .category-sched-list {
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
      background: var(--mat-sys-surface-container, rgba(0, 0, 0, 0.03));
      border: 1px solid var(--mat-sys-outline-variant, rgba(255, 255, 255, 0.08));
      border-radius: 8px;
      padding: 0.75rem 1rem;
    }
    .category-sched-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px dashed var(--mat-sys-outline-variant, rgba(255, 255, 255, 0.06));

      &:last-child {
        padding-bottom: 0;
        border-bottom: none;
      }
    }
    .category-meta {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      min-width: 160px;
    }
    .category-name {
      font-weight: 600;
      font-size: 0.88rem;
      color: var(--mat-sys-on-surface);
    }
    .category-id-badge {
      font-family: monospace;
      font-size: 0.72rem;
      color: var(--mat-sys-on-surface-variant);
    }
    .sched-select-field {
      width: 210px;
      margin-bottom: 0;
    }
    .option-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      width: 100%;

      .option-name {
        font-weight: 600;
        font-size: 0.84rem;
      }
      .option-sub {
        font-size: 0.75rem;
        color: var(--mat-sys-on-surface-variant);
      }
    }
    .empty-pages-notice {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.85rem;
      color: var(--mat-sys-on-surface-variant);
      padding: 0.75rem 0;
    }
    .field-container {
      display: flex;
      flex-direction: column;
    }
    .full-width {
      width: 100%;
    }
    ::ng-deep .mat-mdc-form-field-subscript-wrapper {
      position: static !important;
      height: auto !important;
      min-height: 0 !important;
      margin-top: 6px !important;
      padding: 0 !important;
      overflow: visible !important;
    }
    ::ng-deep .mat-mdc-form-field-hint-wrapper {
      position: static !important;
      display: block !important;
      width: 100% !important;
      height: auto !important;
      padding: 0 !important;
    }
    ::ng-deep .mat-mdc-form-field-hint-spacer {
      display: none !important;
    }
    ::ng-deep .mat-mdc-form-field-hint {
      display: block !important;
      font-size: 0.84rem !important;
      line-height: 1.5 !important;
      letter-spacing: normal !important;
      white-space: normal !important;
      word-break: normal !important;
      color: var(--mat-sys-on-surface-variant) !important;
    }
    ::ng-deep .mat-mdc-form-field-bottom-align::before {
      display: none !important;
      content: none !important;
      height: 0 !important;
    }
    .actions-bar {
      margin-top: 0.5rem;
      padding: 0.75rem 1.75rem 1.25rem;
      gap: 0.75rem;
      border-top: 1px solid var(--mat-sys-outline-variant);
    }
  `],
})
export class EnebaConfigDialogComponent {
  topDealsLimit: number;
  alertThresholdPct: number;
  categoryPages: ScrapePageConfig[] = [];
  schedulers: SchedulerState[] = [];
  pageSchedules: Record<string, string> = {};

  get providerTitle(): string {
    return this.data?.providerDisplayName || 'Provider';
  }

  constructor(
    public dialogRef: MatDialogRef<EnebaConfigDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: EnebaConfigDialogData,
  ) {
    this.topDealsLimit = data?.topDealsLimit ?? 10;
    this.alertThresholdPct = data?.alertThresholdPct ?? 20;
    this.categoryPages = data?.pages || [];
    this.schedulers = data?.schedulers || [];

    for (const page of this.categoryPages) {
      this.pageSchedules[page.id] = page.scheduleId || 'default';
    }
  }

  save() {
    this.dialogRef.close({
      topDealsLimit: Number(this.topDealsLimit),
      alertThresholdPct: Number(this.alertThresholdPct),
      pageSchedules: { ...this.pageSchedules },
    });
  }
}
