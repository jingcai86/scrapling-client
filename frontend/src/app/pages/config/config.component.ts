import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { ApiService } from '../../core/services/api.service';
import { EmailPreviewDialogComponent } from '../../dialogs/email-preview-dialog.component';
import type { EnvFieldSchema } from '../../core/models/dashboard.model';

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
  selector: 'app-config',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatTableModule,
    MatSortModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatTooltipModule,
    MatDialogModule,
    MatSnackBarModule,
  ],
  template: `
    <div class="page-container">
      <mat-card class="main-card" appearance="outlined">
        <mat-card-header class="card-header-flex">
          <div>
            <mat-card-title>System & Database Configuration (<code>scrapling.config</code> & <code>.env</code>)</mat-card-title>
            <mat-card-subtitle>
              Boot variables (<code>PORT</code>, <code>DATABASE_URL</code>) live in <code>{{ envPath() }}</code>; all runtime settings are stored in PostgreSQL table <code>scrapling.config</code>.
            </mat-card-subtitle>
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
    </div>
  `,
  styles: [`
    .page-container {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
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
    }
    .toolbar-actions {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .card-content-wrapper {
      padding: 0 !important;
      overflow-x: auto;
    }
    .data-table {
      width: 100%;
      background: transparent;
    }
    .key-code {
      font-weight: 700;
      color: var(--mat-sys-primary);
    }
    .group-pill {
      font-size: 0.75rem;
      padding: 0.15rem 0.5rem;
      border-radius: 6px;
      background: var(--mat-sys-surface-container-high);
      font-weight: 600;
    }
    .storage-badge {
      font-size: 0.75rem;
      padding: 0.15rem 0.5rem;
      border-radius: 6px;
      background: rgba(16, 185, 129, 0.15);
      color: #10b981;
      font-weight: 700;
      &.env-badge {
        background: rgba(245, 158, 11, 0.15);
        color: #f59e0b;
      }
    }
    .val-cell {
      max-width: 250px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .val-text {
      font-family: ui-monospace, Menlo, Monaco, monospace;
      font-size: 0.85rem;
    }
    .desc-cell {
      font-size: 0.85rem;
      color: var(--mat-sys-on-surface-variant);
    }
    .edit-mode-container {
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }
    .edit-banner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
      padding: 0.85rem 1.25rem;
      border-radius: 10px;
      font-weight: 600;
      font-size: 0.88rem;
    }
    .banner-buttons {
      display: flex;
      gap: 0.5rem;
    }
    .section-box {
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 10px;
      padding: 1.25rem;
      h3 {
        margin: 0 0 0.5rem;
        font-size: 1.05rem;
      }
    }
    .section-hint {
      font-size: 0.8rem;
      color: var(--mat-sys-on-surface-variant);
      margin: 0 0 1rem;
    }
    .fields-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 1rem;
    }
    .full-width {
      width: 100%;
    }
    .custom-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .flex-grow {
      flex: 1;
    }
    .add-custom-box {
      margin-top: 1.25rem;
      padding-top: 1rem;
      border-top: 1px solid var(--mat-sys-outline-variant);
      h4 {
        margin: 0 0 0.75rem;
      }
    }
    .add-custom-fields {
      display: flex;
      gap: 0.75rem;
      align-items: center;
      flex-wrap: wrap;
    }
    .custom-key-field {
      width: 220px;
    }
    .custom-val-field {
      flex: 1;
      min-width: 240px;
    }
  `],
})
export class ConfigComponent {
  displayedColumns: string[] = ['key', 'group', 'storage', 'value', 'description'];
  showSecrets = false;
  isEditMode = false;

  sortedConfig: ConfigRow[] = [];
  editFormValues: Record<string, string> = {};
  newCustomKey = '';
  newCustomVal = '';

  constructor(
    private apiService: ApiService,
    private dialog: MatDialog,
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
        isSecret: s?.isSecret || key.toLowerCase().includes('key') || key.toLowerCase().includes('pass'),
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
    this.apiService.updateEnv(this.editFormValues).subscribe(() => {
      this.snackBar.open('Configuration saved successfully to scrapling.config!', 'OK', { duration: 3000 });
      this.isEditMode = false;
    });
  }

  addCustomVariable() {
    if (!this.newCustomKey.trim()) return;
    const cleanKey = this.newCustomKey.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    this.editFormValues[cleanKey] = this.newCustomVal;
    this.apiService.updateEnv({ [cleanKey]: this.newCustomVal }).subscribe(() => {
      this.snackBar.open(`Added variable ${cleanKey}!`, 'OK', { duration: 3000 });
      this.newCustomKey = '';
      this.newCustomVal = '';
    });
  }

  deleteCustomKey(key: string) {
    if (confirm(`Remove custom variable ${key}?`)) {
      this.apiService.deleteEnvKey(key).subscribe(() => {
        delete this.editFormValues[key];
        this.snackBar.open(`Removed variable ${key}!`, 'OK', { duration: 3000 });
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
