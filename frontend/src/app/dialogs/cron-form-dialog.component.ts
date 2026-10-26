import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import type { SchedulerState } from '../core/models/dashboard.model';

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
    <h2 mat-dialog-title>Edit Daily Randomized Cron Schedule</h2>
    <form (ngSubmit)="save()">
      <div mat-dialog-content class="form-content">
        <mat-checkbox [(ngModel)]="enabled" name="enabled">
          Enable Daily Randomized Cron Job (<code>CRON_ENABLED</code>)
        </mat-checkbox>

        <mat-form-field appearance="outline" class="full-width" subscriptSizing="dynamic">
          <mat-label>Daily Window Start Time (<code>CRON_BASE_TIME</code>)</mat-label>
          <input matInput type="time" [(ngModel)]="baseTime" name="baseTime" required />
          <mat-hint>24-hour time when random window opens (e.g. 19:00 = 7:00 PM)</mat-hint>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width" subscriptSizing="dynamic">
          <mat-label>Random Jitter Window in Minutes (<code>CRON_JITTER_MINUTES</code>)</mat-label>
          <input matInput type="number" [(ngModel)]="jitterMinutes" name="jitterMinutes" min="0" max="720" required />
          <mat-hint>Random delay (0–720 mins) added to start time daily (default: 60)</mat-hint>
        </mat-form-field>
      </div>

      <div mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancel</button>
        <button mat-flat-button color="primary" type="submit">
          Save Schedule
        </button>
      </div>
    </form>
  `,
  styles: [`
    .form-content {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      min-width: 450px;
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
  enabled = true;
  baseTime = '19:00';
  jitterMinutes = 60;

  constructor(
    public dialogRef: MatDialogRef<CronFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { scheduler?: SchedulerState },
  ) {
    if (data.scheduler) {
      this.enabled = data.scheduler.enabled;
      this.baseTime = data.scheduler.baseTime;
      this.jitterMinutes = data.scheduler.jitterMinutes;
    }
  }

  save() {
    this.dialogRef.close({
      enabled: this.enabled,
      baseTime: this.baseTime,
      jitterMinutes: this.jitterMinutes,
    });
  }
}
