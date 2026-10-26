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
      <div class="header-titles">
        <h2 mat-dialog-title class="dialog-title">Resend Email Alert Template Preview</h2>
        <div class="subject-box">
          <span class="subject-label">Subject:</span>
          <span class="subject-text">{{ data.subject }}</span>
          <span *ngIf="data.isSampleData" class="sample-tag">Sample Data</span>
        </div>
      </div>
      <button mat-icon-button mat-dialog-close aria-label="Close dialog" class="close-btn">
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <div mat-dialog-content class="preview-content">
      <iframe
        [srcdoc]="data.html"
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
      max-height: 90vh;
      overflow: hidden;
    }
    .dialog-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding: 1.25rem 1.5rem 0.85rem;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
      background: var(--mat-sys-surface-container);
    }
    .header-titles {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
      min-width: 0;
      margin-right: 0.75rem;
    }
    .dialog-title {
      margin: 0 !important;
      padding: 0 !important;
      font-size: 1.15rem !important;
      font-weight: 700 !important;
      color: var(--mat-sys-on-surface) !important;
      letter-spacing: -0.01em;
      line-height: 1.2;
    }
    .subject-box {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.84rem;
      background: var(--mat-sys-surface-container-high);
      border: 1px solid var(--mat-sys-outline-variant);
      padding: 0.35rem 0.75rem;
      border-radius: 6px;
      overflow: hidden;
    }
    .subject-label {
      font-weight: 700;
      color: var(--mat-sys-on-surface);
      flex-shrink: 0;
    }
    .subject-text {
      color: var(--mat-sys-on-surface-variant);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .sample-tag {
      background: rgba(245, 158, 11, 0.15);
      color: #f59e0b;
      border: 1px solid rgba(245, 158, 11, 0.3);
      padding: 0.1rem 0.5rem;
      border-radius: 9999px;
      font-size: 0.72rem;
      font-weight: 700;
      flex-shrink: 0;
    }
    .close-btn {
      color: var(--mat-sys-on-surface-variant);
      flex-shrink: 0;
    }
    .preview-content {
      padding: 1rem 1.5rem !important;
      margin: 0 !important;
      overflow: hidden !important;
      max-height: none !important;
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
    }
    ::ng-deep .preview-content.mat-mdc-dialog-content {
      overflow: hidden !important;
      max-height: none !important;
      padding: 1rem 1.5rem !important;
    }
    .preview-frame {
      width: 100%;
      height: 560px;
      max-height: calc(85vh - 160px);
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 8px;
      background: #f1f5f9;
      display: block;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }
    .dialog-actions {
      padding: 0.6rem 1.5rem 1rem !important;
      margin: 0 !important;
      border-top: 1px solid var(--mat-sys-outline-variant);
      background: var(--mat-sys-surface-container);
    }
  `],
})
export class EmailPreviewDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA)
    public data: { subject: string; html: string; isSampleData: boolean },
  ) {}
}
