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
import { formatUtcBaseTimeToLocal } from '../core/utils/time.utils';

export interface EnebaConfigDialogData {
  providerDisplayName?: string;
  topDealsLimit: number;
  alertThresholdPct: number;
  pages?: ScrapePageConfig[];
  schedulers?: SchedulerState[];
  timeZone?: string;
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
                    <span class="option-sub">{{ formatLocalBaseTime(sch.baseTime) }} (+0..{{ sch.jitterMinutes }}m)</span>
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
  styleUrl: './eneba-config-dialog.component.scss',
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

  formatLocalBaseTime(baseTime?: string): string {
    return formatUtcBaseTimeToLocal(baseTime || '02:00', this.data?.timeZone);
  }

  save() {
    this.dialogRef.close({
      topDealsLimit: Number(this.topDealsLimit),
      alertThresholdPct: Number(this.alertThresholdPct),
      pageSchedules: { ...this.pageSchedules },
    });
  }
}
