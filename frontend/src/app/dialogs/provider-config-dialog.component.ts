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
import {
  formatUtcBaseTimeToLocal,
  resolveScheduleSelectValue,
} from '../core/utils/time.utils';

export interface ProviderConfigDialogData {
  providerDisplayName?: string;
  topDealsLimit: number;
  alertThresholdPct: number;
  pages?: ScrapePageConfig[];
  schedulers?: SchedulerState[];
  timeZone?: string;
}

export interface ProviderConfigDialogResult {
  topDealsLimit: number;
  alertThresholdPct: number;
  pageSchedules: Record<string, string>;
}

export type EnebaConfigDialogData = ProviderConfigDialogData;
export type EnebaConfigDialogResult = ProviderConfigDialogResult;

@Component({
  selector: 'app-provider-config-dialog',
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
          {{ providerTitle }} Settings
        </h2>
        <p class="dialog-subtitle">
          Configure deal limits, email alert thresholds, and schedule assignments for {{ providerTitle }} targets.
        </p>
      </div>
      <button mat-icon-button mat-dialog-close aria-label="Close dialog" class="close-btn">
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <form (ngSubmit)="save()" class="config-form">
      <div mat-dialog-content class="form-content">
        <div class="section-block">
          <div class="section-title-row">
            <mat-icon class="section-icon">tune</mat-icon>
            <span class="section-heading">Limits &amp; Alert Thresholds</span>
          </div>

          <div class="fields-grid">
            <mat-form-field appearance="outline" class="full-width" subscriptSizing="dynamic">
              <mat-label>Top Deals Limit</mat-label>
              <input
                matInput
                type="number"
                [(ngModel)]="topDealsLimit"
                name="topDealsLimit"
                min="1"
                max="50"
                required
              />
              <mat-hint>Deals persisted per target (1–50)</mat-hint>
            </mat-form-field>

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
              <mat-hint>Min discount % to trigger email alerts</mat-hint>
            </mat-form-field>
          </div>
        </div>

        <mat-divider class="section-divider"></mat-divider>

        <div class="section-block">
          <div class="section-title-row header-with-action">
            <div class="heading-left">
              <mat-icon class="section-icon">schedule</mat-icon>
              <span class="section-heading">Target Schedule Assignments</span>
            </div>
            <a
              mat-button
              color="primary"
              class="manage-scheds-link"
              routerLink="/automation"
              (click)="dialogRef.close()"
            >
              <span>Manage Automation</span>
              <mat-icon class="btn-icon-sm">arrow_forward</mat-icon>
            </a>
          </div>
          <p class="section-description">
            Assign each monitored {{ providerTitle }} target to a daily randomized schedule.
          </p>

          <div class="category-sched-list" *ngIf="categoryPages.length > 0; else noPagesTpl">
            <div class="category-sched-row" *ngFor="let page of categoryPages">
              <div class="category-meta">
                <span class="category-name">{{ page.categoryName || page.name }}</span>
                <span class="category-url-sub">{{ page.url }}</span>
              </div>
              <mat-form-field appearance="outline" class="sched-select-field" subscriptSizing="dynamic">
                <mat-select [(ngModel)]="pageSchedules[page.id]" [name]="'sched_' + page.id">
                  <mat-option *ngFor="let sch of schedulers" [value]="sch.id">
                    {{ sch.name || 'Primary Schedule' }} · {{ formatLocalBaseTime(sch.baseTime) }} (+{{ sch.jitterMinutes }}m)
                  </mat-option>
                </mat-select>
              </mat-form-field>
            </div>
          </div>

          <ng-template #noPagesTpl>
            <div class="empty-pages-notice">
              <mat-icon>info_outline</mat-icon>
              <span>No {{ providerTitle }} targets configured yet. Add targets in Automation.</span>
            </div>
          </ng-template>
        </div>
      </div>

      <div mat-dialog-actions align="end" class="actions-bar">
        <button mat-button type="button" mat-dialog-close>Cancel</button>
        <button mat-flat-button color="primary" type="submit">
          Save Changes
        </button>
      </div>
    </form>
  `,
  styleUrl: './provider-config-dialog.component.scss',
})
export class ProviderConfigDialogComponent {
  topDealsLimit: number;
  alertThresholdPct: number;
  categoryPages: ScrapePageConfig[] = [];
  schedulers: SchedulerState[] = [];
  pageSchedules: Record<string, string> = {};

  get providerTitle(): string {
    return this.data?.providerDisplayName || 'Marketplace';
  }

  constructor(
    public dialogRef: MatDialogRef<ProviderConfigDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ProviderConfigDialogData,
  ) {
    this.topDealsLimit = data?.topDealsLimit ?? 10;
    this.alertThresholdPct = data?.alertThresholdPct ?? 20;
    this.categoryPages = data?.pages || [];
    this.schedulers = data?.schedulers || [];

    for (const page of this.categoryPages) {
      this.pageSchedules[page.id] = resolveScheduleSelectValue(
        page.scheduleId,
        this.schedulers,
      );
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

export { ProviderConfigDialogComponent as EnebaConfigDialogComponent };
