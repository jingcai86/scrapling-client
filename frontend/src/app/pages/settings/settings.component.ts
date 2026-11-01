import { Component, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../../core/services/api.service';
import { EmailPreviewDialogComponent } from '../../dialogs/email-preview-dialog.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatSnackBarModule,
    MatTooltipModule,
  ],
  template: `
    <div class="page-container">
      <!-- Page Header -->
      <div class="page-header">
        <div class="header-titles">
          <h1>Settings</h1>
          <p class="subtitle">
            Manage system configuration, Resend email alerts, timezone, and runtime parameters persisted in PostgreSQL.
          </p>
        </div>
        <div class="header-actions">
          <button mat-stroked-button (click)="refresh()" [disabled]="apiService.isLoading()">
            <mat-icon>refresh</mat-icon>
            <span>Refresh</span>
          </button>
          <button mat-flat-button color="primary" (click)="saveAllConfig()">
            <mat-icon>check</mat-icon>
            <span>Save Changes</span>
          </button>
        </div>
      </div>

      <div class="settings-grid">
        <!-- Email Alerts & Resend Configuration -->
        <mat-card class="main-card" appearance="outlined">
          <mat-card-header class="card-header-clean">
            <div class="header-text">
              <mat-card-title>Email Alerts (Resend)</mat-card-title>
              <mat-card-subtitle>
                Automated deal alert notifications dispatched when discounts meet provider thresholds.
              </mat-card-subtitle>
            </div>
            <div class="card-header-actions">
              <button mat-stroked-button type="button" (click)="previewEmail()">
                <mat-icon>visibility</mat-icon>
                <span>Preview Template</span>
              </button>
              <button
                mat-stroked-button
                color="primary"
                type="button"
                (click)="sendTestEmail()"
                [disabled]="isSendingTest()"
              >
                <mat-icon>send</mat-icon>
                <span>{{ isSendingTest() ? 'Sending...' : 'Send Test Email' }}</span>
              </button>
            </div>
          </mat-card-header>

          <mat-card-content class="settings-card-body">
            <div class="form-grid">
              <mat-form-field appearance="outline" class="full-width" subscriptSizing="dynamic">
                <mat-label>RESEND_API_KEY</mat-label>
                <input
                  matInput
                  [type]="showSecrets['RESEND_API_KEY'] ? 'text' : 'password'"
                  [(ngModel)]="envForm['RESEND_API_KEY']"
                  name="RESEND_API_KEY"
                  placeholder="re_xxxxxxxxx"
                />
                <button
                  mat-icon-button
                  matSuffix
                  type="button"
                  (click)="toggleSecret('RESEND_API_KEY')"
                  aria-label="Toggle visibility"
                >
                  <mat-icon>{{ showSecrets['RESEND_API_KEY'] ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
                <mat-hint>Resend API secret token for transactional alert delivery</mat-hint>
              </mat-form-field>

              <div class="two-col-row">
                <mat-form-field appearance="outline" class="full-width" subscriptSizing="dynamic">
                  <mat-label>ALERT_EMAIL_FROM</mat-label>
                  <input
                    matInput
                    type="text"
                    [(ngModel)]="envForm['ALERT_EMAIL_FROM']"
                    name="ALERT_EMAIL_FROM"
                    placeholder="Scrapling Alerts <onboarding@resend.dev>"
                  />
                  <mat-hint>Verified sender identity</mat-hint>
                </mat-form-field>

                <mat-form-field appearance="outline" class="full-width" subscriptSizing="dynamic">
                  <mat-label>ALERT_EMAIL_TO</mat-label>
                  <input
                    matInput
                    type="text"
                    [(ngModel)]="envForm['ALERT_EMAIL_TO']"
                    name="ALERT_EMAIL_TO"
                    placeholder="you@example.com"
                  />
                  <mat-hint>Comma-separated recipient email addresses</mat-hint>
                </mat-form-field>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- System & Runtime Settings -->
        <mat-card class="main-card" appearance="outlined">
          <mat-card-header class="card-header-clean">
            <div class="header-text">
              <mat-card-title>System &amp; Runtime Parameters</mat-card-title>
              <mat-card-subtitle>
                Scrapling MCP endpoint, display timezone, and database connection state.
              </mat-card-subtitle>
            </div>
          </mat-card-header>

          <mat-card-content class="settings-card-body">
            <div class="form-grid">
              <mat-form-field appearance="outline" class="full-width" subscriptSizing="dynamic">
                <mat-label>SCRAPLING_MCP_URL</mat-label>
                <input
                  matInput
                  type="text"
                  [(ngModel)]="envForm['SCRAPLING_MCP_URL']"
                  name="SCRAPLING_MCP_URL"
                  placeholder="http://localhost:8000/mcp"
                />
                <mat-hint>Streamable HTTP endpoint for the Scrapling headless browser server</mat-hint>
              </mat-form-field>

              <div class="two-col-row">
                <mat-form-field appearance="outline" class="full-width" subscriptSizing="dynamic">
                  <mat-label>Display Timezone (TZ)</mat-label>
                  <input
                    matInput
                    type="text"
                    [(ngModel)]="envForm['TZ']"
                    name="TZ"
                    placeholder="America/Los_Angeles"
                  />
                  <mat-hint>IANA timezone used to convert UTC schedule times on the frontend</mat-hint>
                </mat-form-field>

                <mat-form-field appearance="outline" class="full-width" subscriptSizing="dynamic">
                  <mat-label>Server Port (PORT)</mat-label>
                  <input
                    matInput
                    type="text"
                    [(ngModel)]="envForm['PORT']"
                    name="PORT"
                    placeholder="80"
                  />
                  <mat-hint>HTTP server listening port</mat-hint>
                </mat-form-field>
              </div>

              <mat-form-field appearance="outline" class="full-width" subscriptSizing="dynamic">
                <mat-label>DATABASE_URL (Managed via .env)</mat-label>
                <input
                  matInput
                  [type]="showSecrets['DATABASE_URL'] ? 'text' : 'password'"
                  [ngModel]="envForm['DATABASE_URL']"
                  name="DATABASE_URL"
                  readonly
                />
                <button
                  mat-icon-button
                  matSuffix
                  type="button"
                  (click)="toggleSecret('DATABASE_URL')"
                  aria-label="Toggle visibility"
                >
                  <mat-icon>{{ showSecrets['DATABASE_URL'] ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
                <mat-hint>PostgreSQL connection string (read-only in UI for security)</mat-hint>
              </mat-form-field>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Custom Key-Value Parameters -->
        <mat-card class="main-card full-span" appearance="outlined">
          <mat-card-header class="card-header-clean">
            <div class="header-text">
              <mat-card-title>Custom Configuration Keys</mat-card-title>
              <mat-card-subtitle>
                Add or remove custom key-value pairs stored in <code>scrapling.configs</code>.
              </mat-card-subtitle>
            </div>
          </mat-card-header>

          <mat-card-content class="settings-card-body">
            <div class="custom-keys-list" *ngIf="customEnvKeys().length > 0">
              <div class="custom-key-row" *ngFor="let k of customEnvKeys()">
                <div class="key-badge">{{ k }}</div>
                <mat-form-field appearance="outline" class="val-field" subscriptSizing="dynamic">
                  <input matInput [(ngModel)]="envForm[k]" [name]="'custom_' + k" placeholder="Value" />
                </mat-form-field>
                <button
                  mat-icon-button
                  color="warn"
                  type="button"
                  (click)="deleteKey(k)"
                  matTooltip="Delete key"
                >
                  <mat-icon>delete_outline</mat-icon>
                </button>
              </div>
            </div>

            <div class="add-key-bar">
              <mat-form-field appearance="outline" class="key-input" subscriptSizing="dynamic">
                <mat-label>New Key Name</mat-label>
                <input matInput [(ngModel)]="newKeyName" name="newKeyName" placeholder="e.g. CUSTOM_WEBHOOK_URL" />
              </mat-form-field>
              <mat-form-field appearance="outline" class="val-input" subscriptSizing="dynamic">
                <mat-label>Value</mat-label>
                <input matInput [(ngModel)]="newKeyValue" name="newKeyValue" placeholder="Enter value..." />
              </mat-form-field>
              <button
                mat-stroked-button
                color="primary"
                type="button"
                (click)="addCustomKey()"
                [disabled]="!newKeyName.trim()"
              >
                <mat-icon>add</mat-icon>
                <span>Add Key</span>
              </button>
            </div>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  envForm: Record<string, string> = {};
  showSecrets: Record<string, boolean> = {};
  newKeyName = '';
  newKeyValue = '';
  isSendingTest = signal(false);
  private initialized = false;

  private readonly coreKeys = new Set([
    'RESEND_API_KEY',
    'ALERT_EMAIL_FROM',
    'ALERT_EMAIL_TO',
    'SCRAPLING_MCP_URL',
    'TZ',
    'PORT',
    'DATABASE_URL',
  ]);

  constructor(
    public apiService: ApiService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {
    effect(() => {
      const data = this.apiService.dashboardData();
      if (data?.env?.values && !this.initialized) {
        this.envForm = { ...data.env.values };
        this.initialized = true;
      }
    });
  }

  customEnvKeys(): string[] {
    const data = this.apiService.dashboardData();
    const allKeys = new Set<string>([
      ...Object.keys(data?.env?.values || {}),
      ...Object.keys(this.envForm),
    ]);
    return Array.from(allKeys).filter((k) => !this.coreKeys.has(k));
  }

  toggleSecret(key: string): void {
    this.showSecrets[key] = !this.showSecrets[key];
  }

  refresh(): void {
    this.initialized = false;
    this.apiService.loadDashboard(true);
  }

  addCustomKey(): void {
    const key = this.newKeyName.trim();
    if (!key) return;
    if (key === 'DATABASE_URL') {
      this.snackBar.open('DATABASE_URL is managed in .env and cannot be modified here.', 'OK', { duration: 3000 });
      return;
    }
    this.envForm[key] = this.newKeyValue;
    this.apiService.updateEnv({ [key]: this.newKeyValue }).subscribe({
      next: () => {
        this.newKeyName = '';
        this.newKeyValue = '';
        this.snackBar.open(`Added key "${key}"`, 'OK', { duration: 2500 });
      },
    });
  }

  deleteKey(key: string): void {
    this.apiService.deleteEnvKey(key).subscribe({
      next: () => {
        delete this.envForm[key];
        this.snackBar.open(`Removed key "${key}"`, 'OK', { duration: 2500 });
      },
    });
  }

  saveAllConfig(): void {
    const payload = { ...this.envForm };
    delete payload['DATABASE_URL'];
    this.apiService.updateEnv(payload).subscribe({
      next: () => {
        this.snackBar.open('Settings saved to PostgreSQL', 'OK', { duration: 3000 });
      },
      error: (err) => {
        this.snackBar.open(`Failed to save settings: ${err?.error?.error || err.message}`, 'Close', { duration: 4000 });
      },
    });
  }

  previewEmail(): void {
    this.apiService.previewEmail().subscribe({
      next: (res) => {
        this.dialog.open(EmailPreviewDialogComponent, {
          data: res,
          width: '780px',
          maxWidth: '95vw',
        });
      },
      error: (err) => {
        this.snackBar.open(`Preview failed: ${err?.error?.error || err.message}`, 'Close', { duration: 4000 });
      },
    });
  }

  sendTestEmail(): void {
    this.isSendingTest.set(true);
    const to = this.envForm['ALERT_EMAIL_TO']?.trim() || undefined;
    this.apiService.sendTestEmail(to).subscribe({
      next: (res) => {
        this.isSendingTest.set(false);
        if (res.sent) {
          this.snackBar.open(`Test email sent to ${(res.recipients || []).join(', ')}`, 'OK', { duration: 4000 });
        } else {
          this.snackBar.open(`Email not sent: ${res.error || res.reason || 'Check Resend settings'}`, 'Close', { duration: 5000 });
        }
      },
      error: (err) => {
        this.isSendingTest.set(false);
        this.snackBar.open(`Error sending test email: ${err?.error?.error || err.message}`, 'Close', { duration: 4000 });
      },
    });
  }
}
