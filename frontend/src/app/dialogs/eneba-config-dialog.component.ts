import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface EnebaConfigDialogData {
  topDealsLimit: number;
  alertThresholdPct: number;
}

@Component({
  selector: 'app-eneba-config-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
  ],
  template: `
    <div class="dialog-header">
      <div class="header-left">
        <h2 mat-dialog-title class="dialog-title">
          <span>⚙️ Eneba Scraper &amp; Alert Configuration</span>
        </h2>
        <p class="dialog-subtitle">
          Configure how many top deals to pull per category and the minimum discount % to trigger email alerts.
        </p>
      </div>
      <button mat-icon-button mat-dialog-close aria-label="Close dialog">
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <form (ngSubmit)="save()" class="config-form">
      <div mat-dialog-content class="form-content">
        <div class="field-container">
          <mat-form-field appearance="outline" class="full-width">
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
          <mat-form-field appearance="outline" class="full-width">
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
            <mat-hint>Minimum direct discount percentage required to trigger alert emails</mat-hint>
          </mat-form-field>
        </div>
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
    .schema-badge {
      font-size: 0.75rem;
      padding: 0.2rem 0.5rem;
      border-radius: 6px;
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
      font-weight: 700;
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
      gap: 1.5rem;
      padding: 1.25rem 1.5rem 0.5rem !important;
      overflow: visible !important;
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
      margin-top: 5px !important;
    }
    ::ng-deep .mat-mdc-form-field-hint-wrapper {
      padding: 0 !important;
    }
    ::ng-deep .mat-mdc-form-field-hint {
      display: block !important;
      font-size: 0.78rem !important;
      line-height: 1.35 !important;
      color: var(--mat-sys-on-surface-variant) !important;
    }
    .actions-bar {
      padding: 0.75rem 1.5rem 1.25rem;
      gap: 0.5rem;
    }
  `],
})
export class EnebaConfigDialogComponent {
  topDealsLimit: number;
  alertThresholdPct: number;

  constructor(
    public dialogRef: MatDialogRef<EnebaConfigDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: EnebaConfigDialogData,
  ) {
    this.topDealsLimit = data?.topDealsLimit ?? 10;
    this.alertThresholdPct = data?.alertThresholdPct ?? 20;
  }

  save() {
    this.dialogRef.close({
      topDealsLimit: Number(this.topDealsLimit),
      alertThresholdPct: Number(this.alertThresholdPct),
    });
  }
}
