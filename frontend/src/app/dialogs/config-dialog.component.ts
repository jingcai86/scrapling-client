import { Component, OnInit, DoCheck } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { ApiService } from '../core/services/api.service';
import { EmailPreviewDialogComponent } from './email-preview-dialog.component';

interface ConfigRow {
  key: string;
  group: string;
  value: string;
  description: string;
  isSecret: boolean;
  disabled: boolean;
}

@Component({
  selector: 'app-config-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatCardModule,
    MatTableModule,
    MatSortModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatTooltipModule,
    MatSnackBarModule,
  ],
  template: `
    <div class="dialog-header-bar">
      <div class="header-left">
        <span class="material-symbols-outlined modal-icon">settings</span>
        <div>
          <h2 mat-dialog-title class="modal-title">System & Application Configuration</h2>
          <p class="modal-subtitle">
            Boot variables (<code>PORT</code>, <code>DATABASE_URL</code>) in <code>{{ envPath() }}</code>; runtime settings apply immediately.
          </p>
        </div>
      </div>
      <button mat-icon-button mat-dialog-close aria-label="Close dialog">
        <span class="material-symbols-outlined">close</span>
      </button>
    </div>

    <mat-dialog-content class="modal-content-scroller">
      <!-- System & Database Configuration Card -->
      <mat-card class="main-card" appearance="outlined">
        <mat-card-header class="card-header-flex">
          <div>
            <mat-card-title>Configuration Variables</mat-card-title>
          </div>
          <div class="toolbar-actions">
            <button mat-stroked-button (click)="showSecrets = !showSecrets">
              {{ showSecrets ? '🙈 Hide Secrets' : '👁 Show Secrets' }}
            </button>
            <button mat-stroked-button (click)="previewEmail()">
              ✉ Preview Alert Email
            </button>
            <div class="test-email-group">
              <button mat-flat-button color="accent" (click)="sendTestEmail()" [disabled]="isSendingTestEmail">
                {{ isSendingTestEmail ? '⏳ Sending...' : '🚀 Send Test Email to' }}
              </button>
              <mat-form-field appearance="outline" class="test-email-field" subscriptSizing="dynamic">
                <input matInput type="email" [(ngModel)]="testEmailRecipient" placeholder="Recipient email" aria-label="Test email recipient" />
              </mat-form-field>
            </div>
            <button
              mat-flat-button
              color="primary"
              (click)="saveAllConfig()"
            >
              💾 Save Changes
            </button>
          </div>
        </mat-card-header>

        <mat-card-content class="card-content-wrapper">
          <!-- Form Editor (Edit mode is only mode) -->
          <div class="edit-mode-container">
            <!-- Group 1: Boot Variables (.env) -->
            <div class="section-box">
              <h3>1. Server & Database Boot Variables</h3>
              <p class="section-hint">These variables sit in <code>.env</code> and require app restart if changed.</p>
              <div class="fields-grid">
                <div *ngFor="let item of getItemsByGroup('boot')" class="field-item">
                  <mat-form-field appearance="outline" class="full-width" matTooltip="Change in .env and restart server if changed">
                    <mat-label>{{ item.key }}</mat-label>
                    <input matInput [value]="editFormValues[item.key] || ''" disabled />
                  </mat-form-field>
                </div>
              </div>
            </div>

            <!-- Group 2: Scrapling Anti-Bot & Engine -->
            <div class="section-box">
              <h3>2. Scrapling Anti-Bot & Engine Configuration</h3>
              <div class="fields-grid">
                <div *ngFor="let item of getItemsByGroup('scrapling')" class="field-item">
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>{{ item.key }}</mat-label>
                    <input matInput [(ngModel)]="editFormValues[item.key]" />
                    <mat-hint>{{ item.description }}</mat-hint>
                  </mat-form-field>
                </div>
              </div>
            </div>

            <!-- Group 3: Cron Scheduler -->
            <div class="section-box">
              <h3>3. Daily Randomized Cron Schedule</h3>
              <div class="fields-grid">
                <!-- CRON_ENABLED as true/false dropdown -->
                <div class="field-item">
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>CRON_ENABLED</mat-label>
                    <mat-select [(ngModel)]="editFormValues['CRON_ENABLED']">
                      <mat-option value="true">true</mat-option>
                      <mat-option value="false">false</mat-option>
                    </mat-select>
                    <mat-hint>Whether the daily randomized cron job is active (true/false).</mat-hint>
                  </mat-form-field>
                </div>

                <!-- CRON_BASE_TIME (disabled when CRON_ENABLED === false) -->
                <div class="field-item" [class.field-disabled]="isCronDisabled()">
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>CRON_BASE_TIME</mat-label>
                    <input
                      matInput
                      type="time"
                      [(ngModel)]="editFormValues['CRON_BASE_TIME']"
                      [disabled]="isCronDisabled()"
                    />
                    <mat-hint>Daily window start time (24h HH:MM, e.g. 19:00 = 7:00 PM).</mat-hint>
                  </mat-form-field>
                </div>

                <!-- CRON_JITTER_MINUTES (disabled when CRON_ENABLED === false) -->
                <div class="field-item" [class.field-disabled]="isCronDisabled()">
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>CRON_JITTER_MINUTES</mat-label>
                    <input
                      matInput
                      type="number"
                      [(ngModel)]="editFormValues['CRON_JITTER_MINUTES']"
                      [disabled]="isCronDisabled()"
                      min="0"
                      max="720"
                    />
                    <mat-hint>Random delay window in minutes added to start time daily.</mat-hint>
                  </mat-form-field>
                </div>
              </div>
            </div>

            <!-- Group 4: Alert & Notification -->
            <div class="section-box">
              <h3>4. Alert Thresholds & Notification Configuration</h3>
              <div class="fields-grid">
                <!-- EMAIL_ENABLED as true/false dropdown -->
                <div class="field-item">
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>EMAIL_ENABLED</mat-label>
                    <mat-select [(ngModel)]="editFormValues['EMAIL_ENABLED']">
                      <mat-option value="true">true</mat-option>
                      <mat-option value="false">false</mat-option>
                    </mat-select>
                    <mat-hint>Send email alerts via Resend when deals meet the threshold.</mat-hint>
                  </mat-form-field>
                </div>

                <!-- RESEND_API_KEY (disabled when EMAIL_ENABLED === false) -->
                <div class="field-item" [class.field-disabled]="isEmailDisabled()">
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>RESEND_API_KEY</mat-label>
                    <input
                      matInput
                      [(ngModel)]="editFormValues['RESEND_API_KEY']"
                      [disabled]="isEmailDisabled()"
                      placeholder="re_..."
                    />
                    <mat-hint>Your Resend API key.</mat-hint>
                  </mat-form-field>
                </div>

                <!-- ALERT_EMAIL_FROM (disabled when EMAIL_ENABLED === false) -->
                <div class="field-item" [class.field-disabled]="isEmailDisabled()">
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>ALERT_EMAIL_FROM</mat-label>
                    <input
                      matInput
                      [(ngModel)]="editFormValues['ALERT_EMAIL_FROM']"
                      [disabled]="isEmailDisabled()"
                    />
                    <mat-hint>Verified sender address in Resend.</mat-hint>
                  </mat-form-field>
                </div>

                <!-- ALERT_EMAIL_TO (disabled when EMAIL_ENABLED === false) -->
                <div class="field-item" [class.field-disabled]="isEmailDisabled()">
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>ALERT_EMAIL_TO</mat-label>
                    <input
                      matInput
                      type="email"
                      [(ngModel)]="editFormValues['ALERT_EMAIL_TO']"
                      [disabled]="isEmailDisabled()"
                    />
                    <mat-hint>Recipient email address(es) to notify.</mat-hint>
                  </mat-form-field>
                </div>

                <!-- ALERT_DISCOUNT_THRESHOLD_PCT (disabled when EMAIL_ENABLED === false) -->
                <div class="field-item" [class.field-disabled]="isEmailDisabled()">
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>ALERT_DISCOUNT_THRESHOLD_PCT</mat-label>
                    <input
                      matInput
                      type="number"
                      [(ngModel)]="editFormValues['ALERT_DISCOUNT_THRESHOLD_PCT']"
                      [disabled]="isEmailDisabled()"
                      min="0"
                      max="100"
                    />
                    <mat-hint>Minimum discount % (e.g. 20 for 20% off) to trigger alerts.</mat-hint>
                  </mat-form-field>
                </div>
              </div>
            </div>

            <!-- Group 5: Eneba Scraper & Alert Configuration -->
            <div class="section-box">
              <h3>5. Eneba Scraper &amp; Alert Configuration</h3>
              <p class="section-hint">Settings controlling category deal limits and alerts.</p>
              <div class="fields-grid">
                <div class="field-item">
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>ENEBA_TOP_DEALS_LIMIT</mat-label>
                    <input
                      matInput
                      type="number"
                      [(ngModel)]="editFormValues['ENEBA_TOP_DEALS_LIMIT']"
                      min="1"
                      max="50"
                    />
                    <mat-hint>Number of top-ranked deals to persist per category (1–50)</mat-hint>
                  </mat-form-field>
                </div>
                <div class="field-item">
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>ENEBA_ALERT_THRESHOLD_PCT</mat-label>
                    <input
                      matInput
                      type="number"
                      [(ngModel)]="editFormValues['ENEBA_ALERT_THRESHOLD_PCT']"
                      min="0"
                      max="100"
                    />
                    <mat-hint>Minimum discount % on Eneba to trigger alert email (0–100)</mat-hint>
                  </mat-form-field>
                </div>
              </div>
            </div>
          </div>
        </mat-card-content>
      </mat-card>
    </mat-dialog-content>

    <div mat-dialog-actions align="end" class="modal-actions-bar">
      <button mat-flat-button color="primary" (click)="saveAllConfig()">💾 Save Changes</button>
      <button mat-button mat-dialog-close>Close</button>
    </div>
  `,
  styles: [`
    .dialog-header-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.5rem 0.5rem;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .modal-icon {
      font-size: 2rem;
      color: var(--mat-sys-primary);
    }
    .modal-title {
      margin: 0 !important;
      padding: 0 !important;
      font-size: 1.25rem !important;
      font-weight: 700 !important;
      line-height: 1.2 !important;
    }
    .modal-subtitle {
      margin: 0.2rem 0 0;
      font-size: 0.8rem;
      color: var(--mat-sys-on-surface-variant);
    }
    .modal-content-scroller {
      padding: 1.25rem 1.5rem !important;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      max-height: 75vh;
    }
    .modal-actions-bar {
      padding: 0.75rem 1.5rem;
      border-top: 1px solid var(--mat-sys-outline-variant);
      margin: 0 !important;
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
      padding: 1rem 1.25rem 0.5rem;
    }
    .toolbar-actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .test-email-group {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
    }
    .test-email-field {
      width: 210px;
    }
    .test-email-field ::ng-deep .mat-mdc-text-field-wrapper {
      height: 38px !important;
      padding-top: 0 !important;
      padding-bottom: 0 !important;
    }
    .test-email-field ::ng-deep .mat-mdc-form-field-flex {
      height: 38px !important;
      align-items: center !important;
    }
    .card-content-wrapper {
      padding: 0 1.25rem 1.25rem;
    }
    .data-table {
      width: 100%;
      background: transparent;
    }
    .key-code {
      font-family: monospace;
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--mat-sys-primary);
    }
    .env-lock {
      margin-left: 0.35rem;
      font-size: 0.85rem;
      opacity: 0.8;
    }
    .group-pill {
      display: inline-block;
      padding: 0.2rem 0.5rem;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 600;
      background: var(--mat-sys-surface-container-high);
      color: var(--mat-sys-on-surface-variant);
    }
    .val-cell {
      max-width: 260px;
    }
    .val-text {
      font-family: monospace;
      font-size: 0.85rem;
      word-break: break-all;
    }
    .desc-cell {
      font-size: 0.82rem;
      color: var(--mat-sys-on-surface-variant);
    }

    .edit-mode-container {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }
    .edit-banner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
      font-weight: 600;
      font-size: 0.88rem;
    }
    .banner-buttons {
      display: flex;
      gap: 0.5rem;
    }
    .section-box {
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 8px;
      padding: 1.25rem;
      background: var(--mat-sys-surface-container-low);

      h3 {
        margin: 0 0 0.25rem;
        font-size: 1rem;
        font-weight: 700;
      }
    }
    .section-hint {
      margin: 0 0 1rem;
      font-size: 0.82rem;
      color: var(--mat-sys-on-surface-variant);
    }
    .fields-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1rem;
    }
    .field-item {
      display: flex;
      align-items: center;
      transition: opacity 0.2s ease;

      &.field-disabled {
        opacity: 0.45;
        pointer-events: none;
      }
    }
    .full-width {
      width: 100%;
    }
  `],
})
export class ConfigDialogComponent implements DoCheck {
  displayedColumns: string[] = ['key', 'group', 'value', 'description'];
  showSecrets = false;

  sortedConfig: ConfigRow[] = [];
  editFormValues: Record<string, string> = {};
  testEmailRecipient: string = '';
  isSendingTestEmail = false;
  private testEmailInitialized = false;

  constructor(
    private apiService: ApiService,
    private dialog: MatDialog,
    public dialogRef: MatDialogRef<ConfigDialogComponent>,
    private snackBar: MatSnackBar,
  ) {}

  ngDoCheck() {
    this.syncConfigData();
  }

  private syncConfigData() {
    const data = this.apiService.dashboardData();
    if (!data) return;

    const schema = data.env?.schema || {};
    const values = data.env?.values || {};

    const rows: ConfigRow[] = Object.keys(values).map((key) => {
      const s = Array.isArray(schema)
        ? schema.find((f: any) => f.key === key)
        : (schema as any)[key];
      return {
        key,
        group: s?.group || 'custom',
        value: values[key] ?? '',
        description: s?.description || 'Configuration variable',
        isSecret: Boolean(s?.isSecret || key.toLowerCase().includes('key') || key.toLowerCase().includes('pass')),
        disabled: Boolean(s?.envOnly || key === 'PORT' || key === 'DATABASE_URL'),
      };
    });

    const eneba = data.enebaConfig || {};
    if (eneba['top_deals_limit']) {
      rows.push({
        key: 'ENEBA_TOP_DEALS_LIMIT',
        group: 'eneba',
        value: eneba['top_deals_limit'],
        description: 'Number of top-ranked deals to persist per category in PostgreSQL.',
        isSecret: false,
        disabled: false,
      });
    }
    if (eneba['alert_discount_threshold_pct']) {
      rows.push({
        key: 'ENEBA_ALERT_THRESHOLD_PCT',
        group: 'eneba',
        value: eneba['alert_discount_threshold_pct'],
        description: 'Minimum direct discount % on Eneba to trigger alert email.',
        isSecret: false,
        disabled: false,
      });
    }

    this.sortedConfig = rows;
    if (!this.testEmailInitialized && values['ALERT_EMAIL_TO']) {
      this.testEmailRecipient = values['ALERT_EMAIL_TO'];
      this.testEmailInitialized = true;
    }
    if (Object.keys(this.editFormValues).length === 0) {
      this.editFormValues = {
        ...values,
        ENEBA_TOP_DEALS_LIMIT: eneba['top_deals_limit'] || '10',
        ENEBA_ALERT_THRESHOLD_PCT: eneba['alert_discount_threshold_pct'] || '20',
      };
    }
  }

  isCronDisabled(): boolean {
    return this.editFormValues['CRON_ENABLED'] === 'false';
  }

  isEmailDisabled(): boolean {
    return this.editFormValues['EMAIL_ENABLED'] === 'false';
  }

  envPath(): string {
    return this.apiService.dashboardData()?.env?.envFilePath || '.env';
  }

  displayValue(row: ConfigRow): string {
    if (!row.value) return '(empty string)';
    if (row.isSecret && !this.showSecrets) {
      return '••••••••';
    }
    return row.value;
  }

  getItemsByGroup(group: string): ConfigRow[] {
    return this.sortedConfig.filter((item) => {
      if (group === 'boot') return item.disabled;
      if (group === 'scrapling') return item.group === 'scrapling';
      if (group === 'cron') return item.group === 'scheduler';
      if (group === 'alert') return item.group === 'email';
      return item.group === group;
    });
  }

  saveAllConfig() {
    const updates: Record<string, string> = {};
    for (const [key, val] of Object.entries(this.editFormValues)) {
      if (key === 'ENEBA_TOP_DEALS_LIMIT' || key === 'ENEBA_ALERT_THRESHOLD_PCT') continue;
      const item = this.sortedConfig.find((r) => r.key === key);
      if (item && !item.disabled) {
        updates[key] = val;
      }
    }

    if (this.editFormValues['ENEBA_TOP_DEALS_LIMIT'] || this.editFormValues['ENEBA_ALERT_THRESHOLD_PCT']) {
      const enebaUpdates: Record<string, string> = {};
      if (this.editFormValues['ENEBA_TOP_DEALS_LIMIT']) {
        enebaUpdates['top_deals_limit'] = String(this.editFormValues['ENEBA_TOP_DEALS_LIMIT']);
      }
      if (this.editFormValues['ENEBA_ALERT_THRESHOLD_PCT']) {
        enebaUpdates['alert_discount_threshold_pct'] = String(this.editFormValues['ENEBA_ALERT_THRESHOLD_PCT']);
      }
      this.apiService.updateEnebaConfig(enebaUpdates).subscribe();
    }

    this.apiService.updateEnv(updates).subscribe({
      next: () => {
        this.snackBar.open('Saved configuration successfully!', 'OK', {
          duration: 3500,
        });
        this.apiService.loadDashboard(false);
      },
      error: (err) => {
        this.snackBar.open(`Failed to save config: ${err.message}`, 'OK', {
          duration: 5000,
        });
      },
    });
  }

  previewEmail() {
    this.apiService.previewEmail().subscribe((res) => {
      this.dialog.open(EmailPreviewDialogComponent, {
        data: res,
        width: '720px',
      });
    });
  }

  sendTestEmail() {
    const to = this.testEmailRecipient?.trim() || undefined;
    this.isSendingTestEmail = true;
    this.apiService.sendTestEmail(to).subscribe({
      next: (res) => {
        this.isSendingTestEmail = false;
        if (res.sent) {
          const sentTo = res.recipients ? res.recipients.join(', ') : (to || 'ALERT_EMAIL_TO');
          this.snackBar.open(`Test email sent to ${sentTo}! Message ID: ${res.messageId || 'OK'}`, 'OK', { duration: 4000 });
        } else {
          this.snackBar.open(`Email failed: ${res.error || res.reason}`, 'OK', { duration: 5000 });
        }
      },
      error: (err) => {
        this.isSendingTestEmail = false;
        this.snackBar.open(`Error sending test email: ${err.message}`, 'OK', { duration: 5000 });
      },
    });
  }

  sortConfig(sort: Sort) {
    const data = [...this.sortedConfig];
    if (!sort.active || sort.direction === '') {
      this.sortedConfig = data;
      return;
    }

    this.sortedConfig = data.sort((a, b) => {
      const isAsc = sort.direction === 'asc';
      switch (sort.active) {
        case 'key': return compare(a.key, b.key, isAsc);
        case 'group': return compare(a.group, b.group, isAsc);
        case 'value': return compare(a.value, b.value, isAsc);
        case 'description': return compare(a.description, b.description, isAsc);
        default: return 0;
      }
    });
  }
}

function compare(a: number | string, b: number | string, isAsc: boolean) {
  return (a < b ? -1 : 1) * (isAsc ? 1 : -1);
}
