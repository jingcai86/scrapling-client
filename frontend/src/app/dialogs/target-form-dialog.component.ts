import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import type { ScrapePageConfig, CatalogProduct } from '../core/models/dashboard.model';
import { ApiService } from '../core/services/api.service';

@Component({
  selector: 'app-target-form-dialog',
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
    MatIconModule,
  ],
  template: `
    <div class="dialog-header">
      <div>
        <h2 mat-dialog-title class="dialog-title">
          {{ data.page ? 'Edit Scrape Target' : 'Add Scrape Target' }}
        </h2>
        <p class="dialog-subtitle">
          Configure the marketplace provider, target label, and store listing URL.
        </p>
      </div>
      <button mat-icon-button mat-dialog-close aria-label="Close">
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <form (ngSubmit)="save()">
      <div mat-dialog-content class="form-content">
        <div class="two-col-fields">
          <mat-form-field appearance="outline" class="full-width" subscriptSizing="dynamic">
            <mat-label>Marketplace Provider</mat-label>
            <mat-select [(ngModel)]="form.category" name="category" (selectionChange)="onCategoryChange()">
              <mat-option value="eneba">Eneba</mat-option>
              <mat-option value="g2a">G2A</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width" subscriptSizing="dynamic">
            <mat-label>Catalog Preset (Optional)</mat-label>
            <mat-select [(ngModel)]="form.productId" name="productId" (selectionChange)="onProductSelect()">
              <mat-option [value]="null">-- Custom URL --</mat-option>
              <mat-option *ngFor="let prod of filteredProducts" [value]="prod.id">
                {{ prod.title }}
              </mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline" class="full-width" subscriptSizing="dynamic">
          <mat-label>Target Name</mat-label>
          <input
            matInput
            [(ngModel)]="form.categoryName"
            name="categoryName"
            placeholder="e.g. PlayStation (PSN) Gift Cards"
            required
          />
          <mat-hint>Display label shown in tables and email alerts</mat-hint>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width" subscriptSizing="dynamic">
          <mat-label>Target Store URL</mat-label>
          <input
            matInput
            [(ngModel)]="form.url"
            name="url"
            placeholder="https://www.eneba.com/store/gift-cards..."
            required
          />
          <mat-hint>Direct marketplace category or search URL to scrape</mat-hint>
        </mat-form-field>

        <div class="checkbox-group">
          <mat-checkbox [(ngModel)]="form.withOffers" name="withOffers">
            Fetch competing 3rd-party seller offers for top deals
          </mat-checkbox>
          <mat-checkbox [(ngModel)]="form.enabled" name="enabled">
            Enable target for scheduled &amp; manual scrapes
          </mat-checkbox>
        </div>
      </div>

      <div mat-dialog-actions align="end" class="dialog-actions">
        <button mat-button type="button" mat-dialog-close>Cancel</button>
        <button
          mat-flat-button
          color="primary"
          type="submit"
          [disabled]="!isValid()"
        >
          {{ data.page ? 'Save Changes' : 'Add Target' }}
        </button>
      </div>
    </form>
  `,
  styles: [`
    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 1.25rem 1.5rem 1rem;
      border-bottom: 1px solid var(--ui-border);
    }
    .dialog-title {
      margin: 0 !important;
      padding: 0 !important;
      font-size: 1.125rem;
      font-weight: 600;
      letter-spacing: -0.015em;
    }
    .dialog-subtitle {
      margin: 0.25rem 0 0;
      font-size: 0.8125rem;
      color: var(--mat-sys-on-surface-variant);
    }
    .form-content {
      display: flex;
      flex-direction: column;
      gap: 1.15rem;
      padding: 1.25rem 1.5rem !important;
      min-width: 460px;
      @media (max-width: 560px) {
        min-width: 0;
      }
    }
    .two-col-fields {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
      @media (max-width: 500px) {
        grid-template-columns: 1fr;
      }
    }
    .full-width {
      width: 100%;
    }
    .checkbox-group {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      padding: 0.625rem 0.875rem;
      border: 1px solid var(--ui-border);
      border-radius: 8px;
      background: var(--surface-subtle);
    }
    .dialog-actions {
      padding: 0.875rem 1.5rem !important;
      border-top: 1px solid var(--ui-border);
      margin: 0 !important;
    }
  `],
})
export class TargetFormDialogComponent implements OnInit {
  products: CatalogProduct[] = [];
  filteredProducts: CatalogProduct[] = [];

  form = {
    productId: null as string | null,
    category: 'eneba',
    categoryName: '',
    url: '',
    withOffers: true,
    enabled: true,
  };

  constructor(
    public dialogRef: MatDialogRef<TargetFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { page?: ScrapePageConfig },
    private apiService: ApiService,
  ) {
    if (data.page) {
      const cat = (data.page.category || data.page.provider || 'eneba').toLowerCase();
      this.form = {
        productId: data.page.productId ?? null,
        category: cat,
        categoryName: data.page.categoryName || data.page.name || '',
        url: data.page.url,
        withOffers: data.page.withOffers ?? true,
        enabled: data.page.enabled,
      };
    }
  }

  ngOnInit(): void {
    this.apiService.getProducts().subscribe({
      next: (res) => {
        this.products = res.products || [];
        this.filterProductsByCategory();
      },
    });
  }

  onCategoryChange(): void {
    this.filterProductsByCategory();
  }

  private filterProductsByCategory(): void {
    const cat = this.form.category.toLowerCase();
    this.filteredProducts = this.products.filter(
      (p) => !p.provider || p.provider.toLowerCase() === cat,
    );
  }

  onProductSelect(): void {
    if (!this.form.productId) return;
    const selected = this.products.find((p) => p.id === this.form.productId);
    if (selected) {
      if (selected.url) {
        this.form.url = selected.url;
      }
      if (!this.form.categoryName) {
        this.form.categoryName = selected.title;
      }
    }
  }

  isValid(): boolean {
    return Boolean(this.form.categoryName.trim() && this.form.url.trim());
  }

  save(): void {
    if (!this.isValid()) return;
    this.dialogRef.close({
      ...this.form,
      provider: this.form.category,
      name: this.form.categoryName.trim(),
      categoryName: this.form.categoryName.trim(),
      url: this.form.url.trim(),
    });
  }
}

export { TargetFormDialogComponent as PageFormDialogComponent };
