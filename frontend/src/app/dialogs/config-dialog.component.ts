import { Component, OnInit, OnDestroy } from '@angular/core';
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
        <mat-icon class="modal-icon">settings</mat-icon>
        <div>
          <h2 mat-dialog-title class="modal-title">System & Application Configuration</h2>
          <p class="modal-subtitle">
            Boot variables (<code>PORT</code>, <code>DATABASE_URL</code>) in <code>{{ envPath() }}</code>; runtime settings apply immediately.
          </p>
        </div>
      </div>
      <button mat-icon-button mat-dialog-close aria-label="Close dialog">
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <mat-dialog-content class="modal-content-scroller">
      <!-- System & Database Configuration Card -->
      <mat-card class="main-card" appearance="outlined">
        <mat-card-header class="card-header-flex">
          <mat-card-title>Configuration Variables</mat-card-title>
          <div class="toolbar-actions">
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
                <div *ngFor="let item of bootItems; trackBy: trackByKey" class="field-item">
                  <mat-form-field appearance="outline" class="full-width" subscriptSizing="dynamic" matTooltip="Change in .env and restart server if changed">
                    <mat-label>{{ item.key }}</mat-label>
                    <input matInput [value]="editFormValues[item.key] || ''" disabled />
                  </mat-form-field>
                </div>
              </div>
            </div>

            <!-- Group 2: Scrapling Anti-Bot & Engine -->
            <div class="section-box">
              <h3>2. Scrapling Anti-Bot & Engine Configuration</h3>
              <p class="section-hint">Scrapling MCP server endpoint, request timeouts, and server timezone.</p>
              <div class="fields-grid">
                <div *ngFor="let item of scraplingItems; trackBy: trackByKey" class="field-item">
                  <mat-form-field appearance="outline" class="full-width" subscriptSizing="dynamic">
                    <mat-label>{{ item.key }}</mat-label>
                    <input matInput [(ngModel)]="editFormValues[item.key]" />
                    <mat-hint>{{ item.description }}</mat-hint>
                  </mat-form-field>
                </div>
              </div>
            </div>

            <!-- Group 3: Email Notifications -->
            <div class="section-box">
              <h3>3. Resend Email Notifications</h3>
              <p class="section-hint">Email notification API key, sender address, and recipient settings.</p>
              <div class="fields-grid">
                <!-- EMAIL_ENABLED as true/false dropdown -->
                <div class="field-item">
                  <mat-form-field appearance="outline" class="full-width" subscriptSizing="dynamic">
                    <mat-label>EMAIL_ENABLED</mat-label>
                    <mat-select [(ngModel)]="editFormValues['EMAIL_ENABLED']">
                      <mat-option value="true">true</mat-option>
                      <mat-option value="false">false</mat-option>
                    </mat-select>
                    <mat-hint>Enable or disable automated email notifications via Resend.</mat-hint>
                  </mat-form-field>
                </div>

                <!-- RESEND_API_KEY (disabled when EMAIL_ENABLED === false) -->
                <div class="field-item" [class.field-disabled]="isEmailDisabled()">
                  <mat-form-field appearance="outline" class="full-width" subscriptSizing="dynamic">
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
                  <mat-form-field appearance="outline" class="full-width" subscriptSizing="dynamic">
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
                  <mat-form-field appearance="outline" class="full-width" subscriptSizing="dynamic">
                    <mat-label>ALERT_EMAIL_TO (Default Recipient)</mat-label>
                    <input
                      matInput
                      type="email"
                      [(ngModel)]="editFormValues['ALERT_EMAIL_TO']"
                      [disabled]="isEmailDisabled()"
                    />
                    <mat-hint>Default recipient email address(es) for notifications.</mat-hint>
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
  styleUrl: './config-dialog.component.scss',
})
export class ConfigDialogComponent implements OnInit, OnDestroy {
  displayedColumns: string[] = ['key', 'group', 'value', 'description'];

  sortedConfig: ConfigRow[] = [];
  bootItems: ConfigRow[] = [];
  scraplingItems: ConfigRow[] = [];
  editFormValues: Record<string, string> = {};
  testEmailRecipient: string = '';
  isSendingTestEmail = false;
  private initialized = false;
  private checkTimer?: any;

  constructor(
    private apiService: ApiService,
    private dialog: MatDialog,
    public dialogRef: MatDialogRef<ConfigDialogComponent>,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit() {
    this.syncConfigData();
    if (!this.initialized) {
      this.checkTimer = setInterval(() => {
        if (this.apiService.dashboardData()) {
          this.syncConfigData();
          if (this.initialized) {
            clearInterval(this.checkTimer);
            this.checkTimer = undefined;
          }
        }
      }, 150);
    }
  }

  ngOnDestroy() {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = undefined;
    }
  }

  trackByKey(_index: number, item: ConfigRow): string {
    return item.key;
  }

  private syncConfigData() {
    const data = this.apiService.dashboardData();
    if (!data) return;

    const schema = data.env?.schema || {};
    const values = data.env?.values || {};

    const rows: ConfigRow[] = Object.keys(values)
      .filter((key) => key !== 'ALERT_DISCOUNT_THRESHOLD_PCT')
      .map((key) => {
      const s = Array.isArray(schema)
        ? schema.find((f: any) => f.key === key)
        : (schema as any)[key];
      return {
        key,
        group: s?.group || 'custom',
        value: values[key] ?? '',
        description: s?.description || 'Configuration variable',
        disabled: Boolean(s?.envOnly || key === 'PORT' || key === 'DATABASE_URL'),
      };
    });

    this.sortedConfig = rows;
    this.bootItems = rows.filter((item) => item.disabled);
    this.scraplingItems = rows.filter((item) => item.group === 'scrapling');

    if (!this.testEmailRecipient && values['ALERT_EMAIL_TO']) {
      this.testEmailRecipient = values['ALERT_EMAIL_TO'];
    }

    if (!this.initialized && Object.keys(values).length > 0) {
      this.editFormValues = { ...values };
      this.initialized = true;
    }
  }

  isEmailDisabled(): boolean {
    return this.editFormValues['EMAIL_ENABLED'] === 'false';
  }

  envPath(): string {
    return this.apiService.dashboardData()?.env?.envFilePath || '.env';
  }

  saveAllConfig() {
    const updates: Record<string, string> = {};
    for (const [key, val] of Object.entries(this.editFormValues)) {
      if (key === 'ALERT_DISCOUNT_THRESHOLD_PCT') continue;
      const item = this.sortedConfig.find((r) => r.key === key);
      if (item && !item.disabled) {
        updates[key] = val;
      }
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
        width: '880px',
        maxWidth: '95vw',
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
