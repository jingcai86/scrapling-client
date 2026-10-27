import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { ApiService } from '../core/services/api.service';
import type { ScrapePageConfig, CatalogProduct } from '../core/models/dashboard.model';

@Component({
  selector: 'app-page-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatButtonModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.page?.id ? 'Edit Scraping Target' : 'Add Scraping Target' }}</h2>
    <form (ngSubmit)="save()" #pageForm="ngForm">
      <div mat-dialog-content class="form-content">
        <mat-form-field appearance="outline" class="full-width" subscriptSizing="dynamic">
          <mat-label>Catalog Product</mat-label>
          <mat-select [(ngModel)]="productId" name="productId" (selectionChange)="onProductSelected($event.value)">
            <mat-option [value]="null">-- Select a catalog product --</mat-option>
            <mat-option *ngFor="let prod of products" [value]="prod.id">
              [{{ prod.slug }}] {{ prod.title }} ({{ prod.provider }})
            </mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width" subscriptSizing="dynamic">
          <mat-label>Provider</mat-label>
          <input matInput [(ngModel)]="provider" name="provider" required placeholder="eneba" />
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width" subscriptSizing="dynamic">
          <mat-label>Target Name / Title</mat-label>
          <input matInput [(ngModel)]="categoryName" name="categoryName" placeholder="Xbox Gift Cards" />
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width" subscriptSizing="dynamic">
          <mat-label>Target URL (Derived from Product)</mat-label>
          <input matInput [(ngModel)]="url" name="url" type="url" placeholder="https://www.eneba.com/us/..." />
        </mat-form-field>

        <div class="checkbox-group">
          <mat-checkbox [(ngModel)]="enabled" name="enabled">
            Target Enabled for Scheduled &amp; Batch Scrapes
          </mat-checkbox>
        </div>
      </div>

      <div mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancel</button>
        <button mat-flat-button color="primary" type="submit" [disabled]="!pageForm.valid">
          Save Target
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
export class PageFormDialogComponent implements OnInit {
  productId: string | null = null;
  productSlug = '';
  productTitle = '';
  provider = 'eneba';
  categoryName = '';
  url = '';
  enabled = true;
  products: CatalogProduct[] = [];

  constructor(
    public dialogRef: MatDialogRef<PageFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { page?: ScrapePageConfig },
    private apiService: ApiService,
  ) {
    if (data.page) {
      this.productId = data.page.productId ?? null;
      this.productSlug = data.page.productSlug ?? '';
      this.productTitle = data.page.productTitle ?? '';
      this.provider = data.page.provider;
      this.categoryName = data.page.categoryName || data.page.name || '';
      this.url = data.page.url;
      this.enabled = data.page.enabled;
    }
  }

  ngOnInit(): void {
    this.apiService.getProducts().subscribe({
      next: (res) => {
        this.products = res.products || [];
      },
    });
  }

  onProductSelected(selectedId: string | null): void {
    if (!selectedId) return;
    const found = this.products.find((p) => p.id === selectedId);
    if (found) {
      this.productId = found.id;
      this.productSlug = found.slug;
      this.productTitle = found.title;
      if (!this.categoryName) {
        this.categoryName = found.title;
      }
      if (found.provider) {
        this.provider = found.provider;
      }
      if (found.url) {
        this.url = found.url;
      }
    }
  }

  save() {
    this.dialogRef.close({
      id: this.data.page?.id,
      productId: this.productId,
      productSlug: this.productSlug,
      productTitle: this.productTitle,
      provider: this.provider,
      categoryName: this.categoryName,
      name: this.categoryName,
      url: this.url,
      enabled: this.enabled,
    });
  }
}
