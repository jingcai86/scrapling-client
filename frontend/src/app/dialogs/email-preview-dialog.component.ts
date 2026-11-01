import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
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
            <p class="dialog-subtitle">Rendered HTML dispatch via Resend API</p>
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
        [srcdoc]="data.html"
        class="preview-frame"
        title="Email Alert HTML Preview"
      ></iframe>
    </div>

    <div mat-dialog-actions align="end" class="dialog-actions">
      <button class="btn-close-action" mat-dialog-close>
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
      background: var(--bg-surface, #11131a);
      color: var(--text-primary, #f8fafc);
    }
    .dialog-header {
      display: flex;
      flex-direction: column;
      gap: 0.875rem;
      padding: 1.125rem 1.5rem 1rem;
      border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
      background: var(--bg-elevated, #161922);
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
      width: 36px;
      height: 36px;
      border-radius: 8px;
      background: rgba(99, 102, 241, 0.12);
      border: 1px solid rgba(99, 102, 241, 0.25);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #818cf8;
      flex-shrink: 0;
      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }
    .dialog-title {
      margin: 0 !important;
      padding: 0 !important;
      font-size: 1rem !important;
      font-weight: 600 !important;
      color: var(--text-primary, #f8fafc) !important;
      letter-spacing: -0.015em;
      line-height: 1.25;
    }
    .dialog-subtitle {
      margin: 0.15rem 0 0;
      font-size: 0.75rem;
      color: var(--text-muted, #94a3b8);
    }
    .header-right {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      flex-shrink: 0;
    }
    .status-pill {
      padding: 0.2rem 0.6rem;
      border-radius: 9999px;
      font-size: 0.7rem;
      font-weight: 600;
      letter-spacing: 0.02em;
      &.sample {
        background: rgba(245, 158, 11, 0.12);
        color: #fbbf24;
        border: 1px solid rgba(245, 158, 11, 0.28);
      }
      &.live {
        background: rgba(16, 185, 129, 0.12);
        color: #34d399;
        border: 1px solid rgba(16, 185, 129, 0.28);
      }
    }
    .envelope-meta {
      display: flex;
      flex-direction: column;
      background: rgba(15, 23, 42, 0.45);
      border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
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
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted, #94a3b8);
      flex-shrink: 0;
    }
    .meta-value {
      color: var(--text-primary, #f8fafc);
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .close-btn {
      color: var(--text-muted, #94a3b8);
      flex-shrink: 0;
    }
    .preview-content {
      padding: 1rem 1.25rem !important;
      margin: 0 !important;
      overflow: hidden !important;
      max-height: none !important;
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      background: #0b0d13;
    }
    ::ng-deep .preview-content.mat-mdc-dialog-content {
      overflow: hidden !important;
      max-height: none !important;
      padding: 1rem 1.25rem !important;
    }
    .preview-frame {
      width: 100%;
      height: 620px;
      max-height: calc(88vh - 185px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      background: #f8fafc;
      display: block;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
    }
    .dialog-actions {
      padding: 0.75rem 1.5rem !important;
      margin: 0 !important;
      border-top: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
      background: var(--bg-elevated, #161922);
    }
    .btn-close-action {
      background: var(--accent-primary, #6366f1);
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 7px;
      padding: 0.45rem 1rem;
      font-size: 0.8125rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s ease;
      &:hover {
        background: #4f46e5;
      }
    }
  `],
})
export class EmailPreviewDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA)
    public data: { subject: string; html: string; isSampleData: boolean },
  ) {}
}
