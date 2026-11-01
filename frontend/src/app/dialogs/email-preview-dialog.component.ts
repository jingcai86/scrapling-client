import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-email-preview-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="dialog-header">
      <div class="header-top">
        <div class="title-group">
          <div class="title-icon">
            <mat-icon>mark_email_read</mat-icon>
          </div>
          <div>
            <h2 mat-dialog-title class="dialog-title">Email Alert Template Preview</h2>
            <p class="dialog-subtitle">Exact HTML payload dispatched via Resend API</p>
          </div>
        </div>
        <div class="header-right">
          <span *ngIf="data.isSampleData" class="status-pill sample">Sample Preview Data</span>
          <span *ngIf="!data.isSampleData" class="status-pill live">Live Scraped Deals</span>
          <button mat-icon-button mat-dialog-close aria-label="Close dialog" class="close-btn">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      <div class="envelope-meta">
        <div class="meta-row">
          <span class="meta-label">Subject</span>
          <span class="meta-value">{{ data.subject }}</span>
        </div>
      </div>
    </div>

    <div mat-dialog-content class="preview-content">
      <iframe
        [srcdoc]="trustedHtml"
        class="preview-frame"
        title="Email Alert HTML Preview"
      ></iframe>
    </div>

    <div mat-dialog-actions align="end" class="dialog-actions">
      <button mat-flat-button color="primary" mat-dialog-close>
        Close Preview
      </button>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      max-height: 92vh;
      overflow: hidden;
      background: var(--surface-card, #ffffff);
      color: var(--mat-sys-on-surface, #0f172a);
    }
    .dialog-header {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding: 1.125rem 1.5rem 1rem;
      border-bottom: 1px solid var(--ui-border, #dbe4f0);
      background: linear-gradient(90deg, color-mix(in srgb, var(--accent-indigo, #4f46e5) 8%, var(--surface-card)) 0%, var(--surface-card) 100%);
    }
    .header-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }
    .title-group {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      min-width: 0;
    }
    .title-icon {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);
      box-shadow: 0 2px 8px rgba(79, 70, 229, 0.28);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      flex-shrink: 0;
      mat-icon {
        font-size: 19px;
        width: 19px;
        height: 19px;
      }
    }
    .dialog-title {
      margin: 0 !important;
      padding: 0 !important;
      font-size: 1.05rem !important;
      font-weight: 700 !important;
      color: var(--mat-sys-on-surface, #0f172a) !important;
      letter-spacing: -0.015em;
      line-height: 1.25;
    }
    .dialog-subtitle {
      margin: 0.15rem 0 0;
      font-size: 0.78rem;
      color: var(--mat-sys-on-surface-variant, #64748b);
    }
    .header-right {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      flex-shrink: 0;
    }
    .status-pill {
      padding: 0.22rem 0.65rem;
      border-radius: 9999px;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.02em;
      &.sample {
        background: color-mix(in srgb, var(--status-warning, #f59e0b) 14%, transparent);
        color: var(--status-warning, #d97706);
        border: 1px solid color-mix(in srgb, var(--status-warning, #f59e0b) 32%, transparent);
      }
      &.live {
        background: color-mix(in srgb, var(--status-success, #10b981) 14%, transparent);
        color: var(--status-success, #059669);
        border: 1px solid color-mix(in srgb, var(--status-success, #10b981) 32%, transparent);
      }
    }
    .envelope-meta {
      display: flex;
      flex-direction: column;
      background: var(--surface-subtle, #f1f5f9);
      border: 1px solid var(--ui-border, #dbe4f0);
      border-radius: 8px;
      padding: 0.5rem 0.875rem;
    }
    .meta-row {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      font-size: 0.8125rem;
      min-width: 0;
    }
    .meta-label {
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--accent-indigo, #4f46e5);
      flex-shrink: 0;
    }
    .meta-value {
      color: var(--mat-sys-on-surface, #0f172a);
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .close-btn {
      color: var(--mat-sys-on-surface-variant, #64748b);
      flex-shrink: 0;
    }
    .preview-content {
      padding: 0.875rem 1.25rem !important;
      margin: 0 !important;
      overflow: hidden !important;
      max-height: none !important;
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      background: var(--surface-subtle, #f1f5f9);
    }
    ::ng-deep .preview-content.mat-mdc-dialog-content {
      overflow: hidden !important;
      max-height: none !important;
      padding: 0.875rem 1.25rem !important;
    }
    .preview-frame {
      width: 100%;
      height: 640px;
      max-height: calc(90vh - 180px);
      border: 1px solid var(--ui-border, #dbe4f0);
      border-radius: 12px;
      background: #eef2ff;
      display: block;
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.08);
    }
    .dialog-actions {
      padding: 0.75rem 1.5rem !important;
      margin: 0 !important;
      border-top: 1px solid var(--ui-border, #dbe4f0);
      background: var(--surface-card, #ffffff);
    }
  `],
})
export class EmailPreviewDialogComponent {
  readonly trustedHtml: SafeHtml;

  constructor(
    @Inject(MAT_DIALOG_DATA)
    public data: { subject: string; html: string; isSampleData: boolean },
    private sanitizer: DomSanitizer,
  ) {
    this.trustedHtml = this.sanitizer.bypassSecurityTrustHtml(this.data.html || '');
  }
}
