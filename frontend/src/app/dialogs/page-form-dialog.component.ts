import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import type { ScrapePageConfig } from '../core/models/dashboard.model';

@Component({
  selector: 'app-page-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatButtonModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.page?.id ? 'Edit Scraping Page' : 'Add Scraping Page' }}</h2>
    <form (ngSubmit)="save()" #pageForm="ngForm">
      <div mat-dialog-content class="form-content">
        <mat-form-field appearance="outline" class="full-width" subscriptSizing="dynamic">
          <mat-label>Provider</mat-label>
          <input matInput [(ngModel)]="provider" name="provider" required placeholder="eneba" />
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width" subscriptSizing="dynamic">
          <mat-label>Category Name (Optional)</mat-label>
          <input matInput [(ngModel)]="categoryName" name="categoryName" placeholder="Xbox Gift Cards" />
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width" subscriptSizing="dynamic">
          <mat-label>Category Store URL</mat-label>
          <input matInput [(ngModel)]="url" name="url" type="url" required placeholder="https://www.eneba.com/us/store/xbox-gift-cards" />
        </mat-form-field>

        <div class="checkbox-group">
          <mat-checkbox [(ngModel)]="enabled" name="enabled">
            Page Enabled for Scheduled &amp; Batch Scrapes
          </mat-checkbox>
        </div>
      </div>

      <div mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancel</button>
        <button mat-flat-button color="primary" type="submit" [disabled]="!pageForm.valid">
          Save Page
        </button>
      </div>
    </form>
  `,
  styles: [`
    .form-content {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      min-width: 450px;
    }
    .full-width {
      width: 100%;
    }
    ::ng-deep .mat-mdc-form-field-subscript-wrapper {
      position: static !important;
      height: auto !important;
      min-height: 0 !important;
      margin-top: 6px !important;
      padding: 0 !important;
      overflow: visible !important;
    }
    ::ng-deep .mat-mdc-form-field-subscript-wrapper > * {
      position: static !important;
      height: auto !important;
    }
    ::ng-deep .mat-mdc-form-field-hint-wrapper {
      position: static !important;
      display: block !important;
      width: 100% !important;
      height: auto !important;
      padding: 0 !important;
      overflow: visible !important;
    }
    ::ng-deep .mat-mdc-form-field-hint-spacer {
      display: none !important;
    }
    ::ng-deep .mat-mdc-form-field-hint {
      display: block !important;
      font-size: 0.84rem !important;
      line-height: 1.5 !important;
      letter-spacing: normal !important;
      white-space: normal !important;
      word-break: normal !important;
      color: var(--mat-sys-on-surface-variant) !important;
    }
    ::ng-deep .mat-mdc-form-field-bottom-align::before {
      display: none !important;
      content: none !important;
      height: 0 !important;
    }
    .checkbox-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin: 0.5rem 0;
    }
  `],
})
export class PageFormDialogComponent {
  provider = 'eneba';
  categoryName = '';
  url = '';
  enabled = true;

  constructor(
    public dialogRef: MatDialogRef<PageFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { page?: ScrapePageConfig },
  ) {
    if (data.page) {
      this.provider = data.page.provider;
      this.categoryName = data.page.categoryName || data.page.name || '';
      this.url = data.page.url;
      this.enabled = data.page.enabled;
    }
  }

  save() {
    this.dialogRef.close({
      id: this.data.page?.id,
      provider: this.provider,
      categoryName: this.categoryName,
      name: this.categoryName,
      url: this.url,
      enabled: this.enabled,
    });
  }
}
