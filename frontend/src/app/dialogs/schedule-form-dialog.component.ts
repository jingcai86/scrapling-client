import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import type { SchedulerState } from '../core/models/dashboard.model';
import {
  formatUtcBaseTimeToLocal,
  formatLocalBaseTimeToUtc,
} from '../core/utils/time.utils';

@Component({
  selector: 'app-schedule-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
  ],
  template: `
    <div class="dialog-header">
      <div>
        <h2 mat-dialog-title class="dialog-title">
          {{ data.isNew ? 'New Schedule' : 'Edit Schedule' }}
        </h2>
        <p class="dialog-subtitle">
          Configure the daily execution window and anti-bot jitter delay.
        </p>
      </div>
      <button mat-icon-button mat-dialog-close aria-label="Close">
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <form (ngSubmit)="save()">
      <div mat-dialog-content class="form-content">
        <mat-form-field appearance="outline" class="full-width" subscriptSizing="dynamic">
          <mat-label>Schedule Name</mat-label>
          <input
            matInput
            [(ngModel)]="name"
            name="name"
            placeholder="e.g. Evening Priority Run"
            required
          />
          <mat-hint>Friendly label to identify this schedule</mat-hint>
        </mat-form-field>

        <div class="two-col-fields">
          <mat-form-field appearance="outline" class="full-width" subscriptSizing="dynamic">
            <mat-label>Window Start (Local Time)</mat-label>
            <input matInput type="time" [(ngModel)]="baseTime" name="baseTime" required />
            <mat-hint>Timezone: {{ userTimeZone }}</mat-hint>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width" subscriptSizing="dynamic">
            <mat-label>Jitter Window (Minutes)</mat-label>
            <input
              matInput
              type="number"
              [(ngModel)]="jitterMinutes"
              name="jitterMinutes"
              min="0"
              max="720"
              required
            />
            <mat-hint>Random delay (0–720m)</mat-hint>
          </mat-form-field>
        </div>

        <div class="checkbox-box">
          <mat-checkbox [(ngModel)]="enabled" name="enabled">
            Enable automated daily execution
          </mat-checkbox>
        </div>
      </div>

      <div mat-dialog-actions align="end" class="dialog-actions">
        <button mat-button type="button" mat-dialog-close>Cancel</button>
        <button mat-flat-button color="primary" type="submit" [disabled]="!name.trim()">
          {{ data.isNew ? 'Create Schedule' : 'Save Changes' }}
        </button>
      </div>
    </form>
  `,
  styles: [`
    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 1.25rem 1.5rem 1rem;
      border-bottom: 1px solid var(--ui-border);
    }
    .dialog-title {
      margin: 0 !important;
      padding: 0 !important;
      font-size: 1.125rem;
      font-weight: 600;
      letter-spacing: -0.015em;
    }
    .dialog-subtitle {
      margin: 0.25rem 0 0;
      font-size: 0.8125rem;
      color: var(--mat-sys-on-surface-variant);
    }
    .form-content {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      padding: 1.25rem 1.5rem !important;
      min-width: 440px;
      @media (max-width: 540px) {
        min-width: 0;
      }
    }
    .two-col-fields {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
      @media (max-width: 500px) {
        grid-template-columns: 1fr;
      }
    }
    .full-width {
      width: 100%;
    }
    .checkbox-box {
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--ui-border);
      border-radius: 8px;
      background: var(--surface-subtle);
    }
    .dialog-actions {
      padding: 0.875rem 1.5rem !important;
      border-top: 1px solid var(--ui-border);
      margin: 0 !important;
    }
  `],
})
export class ScheduleFormDialogComponent {
  name = 'Custom Schedule';
  enabled = true;
  baseTime = '19:00';
  jitterMinutes = 60;
  userTimeZone: string;

  constructor(
    public dialogRef: MatDialogRef<ScheduleFormDialogComponent>,
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
    if (!this.name.trim()) return;
    const utcBaseTime = formatLocalBaseTimeToUtc(this.baseTime, this.userTimeZone);
    this.dialogRef.close({
      name: this.name.trim() || 'Schedule',
      enabled: this.enabled,
      baseTimeUtc: utcBaseTime,
      baseTime: utcBaseTime,
      jitterMinutes: Math.max(0, Math.min(720, Number(this.jitterMinutes) || 0)),
    });
  }
}

export { ScheduleFormDialogComponent as CronFormDialogComponent };
