import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-email-preview-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Resend Email Alert Template Preview</h2>
    <div mat-dialog-content class="preview-content">
      <div class="subject-box">
        <strong>Subject:</strong> {{ data.subject }}
        <span *ngIf="data.isSampleData" class="sample-tag">(Sample Data)</span>
      </div>
      <iframe [srcdoc]="data.html" class="preview-frame" title="Email Alert HTML Preview"></iframe>
    </div>
    <div mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Close</button>
    </div>
  `,
  styles: [`
    .preview-content {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      min-width: 650px;
    }
    .subject-box {
      font-size: 0.88rem;
      color: var(--mat-sys-on-surface-variant);
      background: var(--mat-sys-surface-container-high);
      padding: 0.5rem 0.75rem;
      border-radius: 6px;
    }
    .sample-tag {
      margin-left: 0.5rem;
      font-size: 0.75rem;
      color: #f59e0b;
      font-weight: 700;
    }
    .preview-frame {
      width: 100%;
      height: 480px;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 8px;
      background: #ffffff;
    }
  `],
})
export class EmailPreviewDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA)
    public data: { subject: string; html: string; isSampleData: boolean },
  ) {}
}
