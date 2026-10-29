import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import type { SchedulerState } from '../core/models/dashboard.model';
import {
  formatUtcBaseTimeToLocal,
  formatLocalBaseTimeToUtc,
} from '../core/utils/time.utils';

@Component({
  selector: 'app-cron-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatButtonModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.isNew ? 'Create New Scraping Schedule' : 'Edit Scraping Schedule' }}</h2>
    <form (ngSubmit)="save()">
      <div mat-dialog-content class="form-content">
        <mat-form-field appearance="outline" class="full-width" subscriptSizing="dynamic">
          <mat-label>Schedule Name</mat-label>
          <input matInput [(ngModel)]="name" name="name" placeholder="e.g. Evening Priority Run, Nightly Scan" required />
          <mat-hint>Friendly label to identify this scraping schedule</mat-hint>
        </mat-form-field>

        <mat-checkbox [(ngModel)]="enabled" name="enabled">
          Enable this automated schedule
        </mat-checkbox>

        <mat-form-field appearance="outline" class="full-width" subscriptSizing="dynamic">
          <mat-label>Daily Window Start Time (Local Time)</mat-label>
          <input matInput type="time" [(ngModel)]="baseTime" name="baseTime" required />
          <mat-hint>Local time when the randomized window begins (auto-saved as UTC). Timezone: {{ userTimeZone }}</mat-hint>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width" subscriptSizing="dynamic">
          <mat-label>Random Jitter Window (Minutes)</mat-label>
          <input matInput type="number" [(ngModel)]="jitterMinutes" name="jitterMinutes" min="0" max="720" required />
          <mat-hint>Random delay (0–720 mins) added to start time daily to prevent anti-bot detection</mat-hint>
        </mat-form-field>
      </div>

      <div mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancel</button>
        <button mat-flat-button color="primary" type="submit">
          {{ data.isNew ? 'Create Schedule' : 'Save Changes' }}
        </button>
      </div>
    </form>
  `,
  styles: [`
    .form-content {
      display: flex;
      flex-direction: column;
      gap: 1.15rem;
      min-width: 460px;
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
    ::ng-deep .mat-mdc-form-field-subscript-wrapper > * {
      position: static !important;
      height: auto !important;
    }
    ::ng-deep .mat-mdc-form-field-hint-wrapper {
      position: static !important;
      display: block !important;
      width: 100% !important;
      height: auto !important;
      padding: 0 !important;
      overflow: visible !important;
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
  `],
})
export class CronFormDialogComponent {
  name = 'Custom Schedule';
  enabled = true;
  baseTime = '19:00';
  jitterMinutes = 60;
  userTimeZone: string;

  constructor(
    public dialogRef: MatDialogRef<CronFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA)
    public data: { scheduler?: SchedulerState; isNew?: boolean; timeZone?: string },
  ) {
    this.userTimeZone =
      data.timeZone?.trim() ||
      Intl.DateTimeFormat().resolvedOptions().timeZone ||
      'America/Los_Angeles';

    if (data.scheduler) {
      this.name = data.scheduler.name || (data.isNew ? 'Custom Schedule' : 'Primary Schedule');
      this.enabled = data.scheduler.enabled ?? true;
      this.baseTime = formatUtcBaseTimeToLocal(data.scheduler.baseTime || '02:00', this.userTimeZone);
      this.jitterMinutes = data.scheduler.jitterMinutes ?? 60;
    } else if (data.isNew) {
      this.name = 'New Schedule';
      this.baseTime = formatUtcBaseTimeToLocal('02:00', this.userTimeZone);
    }
  }

  save() {
    const utcBaseTime = formatLocalBaseTimeToUtc(this.baseTime, this.userTimeZone);
    this.dialogRef.close({
      name: this.name.trim() || 'Schedule',
      enabled: this.enabled,
      baseTimeUtc: utcBaseTime,
      baseTime: utcBaseTime,
      jitterMinutes: this.jitterMinutes,
    });
  }
}
