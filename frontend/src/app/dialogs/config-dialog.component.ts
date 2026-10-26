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
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { ApiService } from '../core/services/api.service';
import { ThemeService } from '../core/services/theme.service';
import { EmailPreviewDialogComponent } from './email-preview-dialog.component';
import type { EnvFieldSchema } from '../core/models/dashboard.model';

interface ConfigRow {
  key: string;
  group: string;
  storage: 'env' | 'db';
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
            Boot variables (<code>PORT</code>, <code>DATABASE_URL</code>) in <code>{{ envPath() }}</code>; runtime settings in PostgreSQL table <code>scrapling.config</code>.
          </p>
        </div>
      </div>
      <button mat-icon-button mat-dialog-close aria-label="Close dialog">
        <span class="material-symbols-outlined">close</span>
      </button>
    </div>

    <mat-dialog-content class="modal-content-scroller">
      <!-- 1. Appearance & Theme Selector -->
      <mat-card class="theme-card" appearance="outlined">
        <mat-card-header class="theme-card-header">
          <div class="card-title-flex">
            <span class="material-symbols-outlined section-icon">palette</span>
            <div>
              <mat-card-title>Interface Appearance & Color Theme</mat-card-title>
              <mat-card-subtitle>
                Select your preferred UI color scheme. Choose <strong>System Default</strong> to automatically follow your device's light or dark mode setting.
              </mat-card-subtitle>
            </div>
          </div>
        </mat-card-header>
        <mat-card-content class="theme-card-content">
          <div class="theme-button-group">
            <button
              mat-stroked-button
              type="button"
              class="theme-choice-btn"
              [class.active]="themeService.themeMode() === 'system'"
              (click)="themeService.setTheme('system')"
            >
              <span class="material-symbols-outlined btn-icon">desktop_windows</span>
              <span class="btn-text">System Default</span>
              <span class="material-symbols-outlined checkmark" *ngIf="themeService.themeMode() === 'system'">check_circle</span>
            </button>

            <button
              mat-stroked-button
              type="button"
              class="theme-choice-btn"
              [class.active]="themeService.themeMode() === 'light'"
              (click)="themeService.setTheme('light')"
            >
              <span class="material-symbols-outlined btn-icon">light_mode</span>
              <span class="btn-text">Light Theme</span>
              <span class="material-symbols-outlined checkmark" *ngIf="themeService.themeMode() === 'light'">check_circle</span>
            </button>

            <button
              mat-stroked-button
              type="button"
              class="theme-choice-btn"
              [class.active]="themeService.themeMode() === 'dark'"
              (click)="themeService.setTheme('dark')"
            >
              <span class="material-symbols-outlined btn-icon">dark_mode</span>
              <span class="btn-text">Dark Theme</span>
              <span class="material-symbols-outlined checkmark" *ngIf="themeService.themeMode() === 'dark'">check_circle</span>
            </button>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- 2. System & Database Configuration Card -->
      <mat-card class="main-card" appearance="outlined">
        <mat-card-header class="card-header-flex">
          <div>
            <mat-card-title>Configuration Variables (<code>scrapling.config</code> & <code>.env</code>)</mat-card-title>
          </div>
          <div class="toolbar-actions">
            <button mat-stroked-button (click)="showSecrets = !showSecrets">
              {{ showSecrets ? '🙈 Hide Secrets' : '👁 Show Secrets' }}
            </button>
            <button mat-stroked-button (click)="previewEmail()">
              ✉ Preview Alert Email
            </button>
            <button mat-flat-button color="accent" (click)="sendTestEmail()">
              🚀 Send Test Email
            </button>
            <button
              mat-flat-button
              color="primary"
              (click)="isEditMode = !isEditMode"
            >
              {{ isEditMode ? '✕ Exit Edit Mode' : '✎ Edit Configuration' }}
            </button>
          </div>
        </mat-card-header>

        <mat-card-content class="card-content-wrapper">
          <!-- VIEW MODE: Sortable Read-Only Configuration Table -->
          <div *ngIf="!isEditMode">
            <table mat-table [dataSource]="sortedConfig" matSort (matSortChange)="sortConfig($event)" class="data-table">
              <ng-container matColumnDef="key">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Variable Key</th>
                <td mat-cell *matCellDef="let row">
                  <code class="key-code">{{ row.key }}</code>
                </td>
              </ng-container>

              <ng-container matColumnDef="group">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Section</th>
                <td mat-cell *matCellDef="let row">
                  <span class="group-pill">{{ row.group | titlecase }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="storage">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Storage</th>
                <td mat-cell *matCellDef="let row">
                  <span class="storage-badge" [class.env-badge]="row.storage === 'env'">
                    {{ row.storage === 'env' ? '.env (Boot)' : 'scrapling.config' }}
                  </span>
                </td>
              </ng-container>

              <ng-container matColumnDef="value">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Current Value</th>
                <td mat-cell *matCellDef="let row" class="val-cell">
                  <span class="val-text">{{ displayValue(row) }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="description">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Description</th>
                <td mat-cell *matCellDef="let row" class="desc-cell">
                  {{ row.description }}
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
            </table>
          </div>

          <!-- EDIT MODE: Sectioned Form Editor -->
          <div *ngIf="isEditMode" class="edit-mode-container">
            <div class="edit-banner">
              <span>Editing Configuration — Runtime settings save to PostgreSQL <code>scrapling.config</code> and apply immediately.</span>
              <div class="banner-buttons">
                <button mat-stroked-button (click)="isEditMode = false">Cancel</button>
                <button mat-flat-button color="primary" (click)="saveAllConfig()">💾 Save Changes</button>
              </div>
            </div>

            <!-- Group 1: Boot Variables (.env) -->
            <div class="section-box">
              <h3>1. Server & Database Boot Variables</h3>
              <p class="section-hint">These variables sit in <code>.env</code> and cannot be changed via UI (require app restart).</p>
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
                <div *ngFor="let item of getItemsByGroup('bot')" class="field-item">
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>{{ item.key }}</mat-label>
                    <input matInput [(ngModel)]="editFormValues[item.key]" />
                    <mat-hint>{{ item.description }}</mat-hint>
                  </mat-form-field>
                </div>
              </div>
            </div>

            <!-- Group 3: Alert & Notification -->
            <div class="section-box">
              <h3>3. Alert Thresholds & Notification Configuration</h3>
              <div class="fields-grid">
                <div *ngFor="let item of getItemsByGroup('alert')" class="field-item">
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>{{ item.key }}</mat-label>
                    <input matInput [(ngModel)]="editFormValues[item.key]" />
                    <mat-hint>{{ item.description }}</mat-hint>
                  </mat-form-field>
                </div>
              </div>
            </div>

            <!-- Group 4: Cron Scheduler -->
            <div class="section-box">
              <h3>4. Daily Randomized Cron Schedule</h3>
              <div class="fields-grid">
                <div *ngFor="let item of getItemsByGroup('cron')" class="field-item">
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>{{ item.key }}</mat-label>
                    <input matInput [(ngModel)]="editFormValues[item.key]" />
                    <mat-hint>{{ item.description }}</mat-hint>
                  </mat-form-field>
                </div>
              </div>
            </div>

            <!-- Group 5: Custom Variables -->
            <div class="section-box">
              <h3>5. Custom & Third-Party Configuration</h3>
              <div class="fields-grid">
                <div *ngFor="let item of getItemsByGroup('custom')" class="field-item custom-row">
                  <mat-form-field appearance="outline" class="flex-grow">
                    <mat-label>{{ item.key }}</mat-label>
                    <input matInput [(ngModel)]="editFormValues[item.key]" />
                  </mat-form-field>
                  <button mat-icon-button color="warn" (click)="deleteCustomKey(item.key)" matTooltip="Delete variable">
                    <span class="material-symbols-outlined">delete</span>
                  </button>
                </div>
              </div>

              <!-- Add new custom variable -->
              <div class="add-custom-box">
                <h4>+ Add Custom Configuration Variable (<code>scrapling.config</code>)</h4>
                <div class="add-custom-fields">
                  <mat-form-field appearance="outline" class="custom-key-field">
                    <mat-label>Variable Name</mat-label>
                    <input matInput [(ngModel)]="newCustomKey" placeholder="CUSTOM_KEY" />
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="custom-val-field">
                    <mat-label>Value</mat-label>
                    <input matInput [(ngModel)]="newCustomVal" placeholder="value" />
                  </mat-form-field>
                  <button mat-flat-button (click)="addCustomVariable()">+ Add</button>
                </div>
              </div>
            </div>
          </div>
        </mat-card-content>
      </mat-card>
    </mat-dialog-content>

    <div mat-dialog-actions align="end" class="modal-actions-bar">
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

    .theme-card {
      background: var(--mat-sys-surface-container);
      border-radius: 12px;
      padding-bottom: 0.5rem;
    }
    .theme-card-header {
      padding: 1rem 1.25rem 0.5rem;
    }
    .card-title-flex {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .section-icon {
      font-size: 1.5rem;
      color: var(--mat-sys-primary);
    }
    .theme-card-content {
      padding: 0 1.25rem 0.75rem;
    }
    .theme-button-group {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
      margin-top: 0.35rem;
    }
    .theme-choice-btn {
      display: inline-flex !important;
      align-items: center !important;
      gap: 0.5rem !important;
      padding: 0.4rem 1.15rem !important;
      height: 40px !important;
      border-radius: 20px !important;
      font-weight: 600 !important;
      font-size: 0.88rem !important;
      border-color: var(--mat-sys-outline-variant) !important;
      color: var(--mat-sys-on-surface-variant) !important;
      background: var(--mat-sys-surface-container-high) !important;
      transition: all 0.2s ease !important;

      &.active {
        border-color: var(--mat-sys-primary) !important;
        background: var(--mat-sys-primary-container) !important;
        color: var(--mat-sys-primary) !important;
      }
    }
    .btn-icon {
      font-size: 1.2rem !important;
    }
    .checkmark {
      font-size: 1.1rem !important;
      color: var(--mat-sys-primary) !important;
      margin-left: 0.25rem;
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
      gap: 0.5rem;
      flex-wrap: wrap;
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
    .group-pill {
      display: inline-block;
      padding: 0.2rem 0.5rem;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 600;
      background: var(--mat-sys-surface-container-high);
      color: var(--mat-sys-on-surface-variant);
    }
    .storage-badge {
      display: inline-block;
      padding: 0.2rem 0.5rem;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 700;
      background: rgba(99, 102, 241, 0.15);
      color: #818cf8;

      &.env-badge {
        background: rgba(16, 185, 129, 0.15);
        color: #34d399;
      }
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
    }
    .custom-row {
      gap: 0.5rem;
    }
    .flex-grow {
      flex: 1;
    }
    .full-width {
      width: 100%;
    }
    .add-custom-box {
      margin-top: 1.25rem;
      padding-top: 1rem;
      border-top: 1px dashed var(--mat-sys-outline-variant);

      h4 {
        margin: 0 0 0.75rem;
        font-size: 0.9rem;
        font-weight: 600;
      }
    }
    .add-custom-fields {
      display: flex;
      gap: 0.75rem;
      align-items: center;
      flex-wrap: wrap;
    }
    .custom-key-field,
    .custom-val-field {
      flex: 1;
      min-width: 200px;
    }
  `],
})
export class ConfigDialogComponent implements DoCheck {
  displayedColumns: string[] = ['key', 'group', 'storage', 'value', 'description'];
  showSecrets = false;
  isEditMode = false;

  sortedConfig: ConfigRow[] = [];
  editFormValues: Record<string, string> = {};
  newCustomKey = '';
  newCustomVal = '';

  constructor(
    private apiService: ApiService,
    public themeService: ThemeService,
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
      const s = schema[key];
      return {
        key,
        group: s?.group || 'custom',
        storage: s?.storage || (key === 'PORT' || key === 'DATABASE_URL' ? 'env' : 'db'),
        value: values[key] ?? '',
        description: s?.description || 'Custom configuration variable stored in scrapling.config',
        isSecret: Boolean(s?.isSecret || key.toLowerCase().includes('key') || key.toLowerCase().includes('pass')),
        disabled: s?.storage === 'env' || key === 'PORT' || key === 'DATABASE_URL',
      };
    });

    this.sortedConfig = rows;
    if (!this.isEditMode) {
      this.editFormValues = { ...values };
    }
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
    return this.sortedConfig.filter((item) => item.group === group);
  }

  saveAllConfig() {
    const updates: Record<string, string> = {};
    for (const [key, val] of Object.entries(this.editFormValues)) {
      const item = this.sortedConfig.find((r) => r.key === key);
      if (item && !item.disabled) {
        updates[key] = val;
      }
    }

    this.apiService.updateEnv(updates).subscribe({
      next: () => {
        this.snackBar.open('Saved configuration to PostgreSQL scrapling.config!', 'OK', {
          duration: 3500,
        });
        this.isEditMode = false;
        this.apiService.loadDashboard(false);
      },
      error: (err) => {
        this.snackBar.open(`Failed to save config: ${err.message}`, 'OK', {
          duration: 5000,
        });
      },
    });
  }

  addCustomVariable() {
    const cleanKey = this.newCustomKey.trim().toUpperCase();
    if (!cleanKey) return;

    this.editFormValues[cleanKey] = this.newCustomVal;
    this.apiService.updateEnv({ [cleanKey]: this.newCustomVal }).subscribe(() => {
      this.snackBar.open(`Added variable ${cleanKey}!`, 'OK', { duration: 3000 });
      this.newCustomKey = '';
      this.newCustomVal = '';
      this.apiService.loadDashboard(false);
    });
  }

  deleteCustomKey(key: string) {
    if (confirm(`Remove custom variable ${key}?`)) {
      this.apiService.deleteEnvKey(key).subscribe(() => {
        delete this.editFormValues[key];
        this.snackBar.open(`Removed variable ${key}!`, 'OK', { duration: 3000 });
        this.apiService.loadDashboard(false);
      });
    }
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
    this.apiService.sendTestEmail().subscribe((res) => {
      if (res.sent) {
        this.snackBar.open(`Test email sent! Message ID: ${res.messageId}`, 'OK', { duration: 4000 });
      } else {
        this.snackBar.open(`Email failed: ${res.error || res.reason}`, 'OK', { duration: 5000 });
      }
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
        case 'storage': return compare(a.storage, b.storage, isAsc);
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
