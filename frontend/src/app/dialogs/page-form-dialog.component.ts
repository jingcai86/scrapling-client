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
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Provider</mat-label>
          <input matInput [(ngModel)]="provider" name="provider" required placeholder="eneba" />
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Category Name</mat-label>
          <input matInput [(ngModel)]="categoryName" name="categoryName" required placeholder="Xbox Gift Cards" />
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Category Store URL</mat-label>
          <input matInput [(ngModel)]="url" name="url" type="url" required placeholder="https://www.eneba.com/us/store/xbox-gift-cards" />
        </mat-form-field>

        <div class="checkbox-group">
          <mat-checkbox [(ngModel)]="withOffers" name="withOffers">
            Scrape seller details for top deals (competing merchant pricing &amp; ratings)
          </mat-checkbox>
          <mat-checkbox [(ngModel)]="enabled" name="enabled">
            Page Enabled for Scheduled & Batch Scrapes
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
  withOffers = true;
  enabled = true;

  constructor(
    public dialogRef: MatDialogRef<PageFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { page?: ScrapePageConfig },
  ) {
    if (data.page) {
      this.provider = data.page.provider;
      this.categoryName = data.page.categoryName;
      this.url = data.page.url;
      this.withOffers = data.page.withOffers;
      this.enabled = data.page.enabled;
    }
  }

  save() {
    this.dialogRef.close({
      id: this.data.page?.id,
      provider: this.provider,
      categoryName: this.categoryName,
      url: this.url,
      withOffers: this.withOffers,
      enabled: this.enabled,
    });
  }
}
