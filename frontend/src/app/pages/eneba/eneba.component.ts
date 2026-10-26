import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { ApiService } from '../../core/services/api.service';
import { SellerOffersDialogComponent } from '../../dialogs/seller-offers-dialog.component';
import { EnebaConfigDialogComponent } from '../../dialogs/eneba-config-dialog.component';
import type { PageDealStatus, RankedDeal, SellerOffer } from '../../core/models/dashboard.model';

@Component({
  selector: 'app-eneba',
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
    MatSelectModule,
    MatDialogModule,
    MatSnackBarModule,
  ],
  template: `
    <div class="page-container">
      <!-- Eneba KPIs -->
      <div class="kpi-grid">
        <mat-card class="kpi-card" appearance="outlined">
          <mat-card-header>
            <mat-card-subtitle>Eneba Store Categories</mat-card-subtitle>
            <mat-card-title class="kpi-value">{{ categoriesCount() }}</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="kpi-sub">PlayStation, Nintendo, Android, Amazon, Apple</div>
          </mat-card-content>
        </mat-card>

        <mat-card class="kpi-card" appearance="outlined">
          <mat-card-header>
            <mat-card-subtitle>Eneba Cards In Stock</mat-card-subtitle>
            <mat-card-title class="kpi-value">{{ totalInStock() }}</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="kpi-sub">{{ totalDiscounted() }} with direct discount</div>
          </mat-card-content>
        </mat-card>

        <mat-card class="kpi-card" appearance="outlined">
          <mat-card-header>
            <mat-card-subtitle>Best Eneba Deal</mat-card-subtitle>
            <mat-card-title class="kpi-value best-pct">{{ bestDealPct() }}</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="kpi-sub truncate" [title]="bestDealTitle()">{{ bestDealTitle() }}</div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Eneba Action Bar -->
      <div class="eneba-action-bar">
        <div class="config-summary-pill">
          <span class="schema-badge">scrapling.eneba_config</span>
          <span class="summary-text">
            Pull Limit: <strong>{{ topDealsLimit }}</strong> • Alert Threshold: <strong>{{ alertThresholdPct }}%</strong>
          </span>
        </div>
        <div class="action-buttons">
          <button mat-stroked-button type="button" class="action-btn" (click)="openEnebaConfigModal()">
            <span class="material-symbols-outlined btn-icon">settings</span>
            Configuration
          </button>
          <button mat-flat-button color="primary" type="button" class="action-btn" (click)="triggerScrape()">
            <span class="material-symbols-outlined btn-icon">play_arrow</span>
            Scrape Now
          </button>
        </div>
      </div>

      <!-- Category Summary Table -->
      <mat-card class="main-card" appearance="outlined">
        <mat-card-header class="table-header">
          <div>
            <mat-card-title>Eneba Gift Card Categories — Status & Seller Offers</mat-card-title>
            <mat-card-subtitle>
              Category-specific metrics including discount percentages and competing merchant offers. Click any column header to sort.
            </mat-card-subtitle>
          </div>
        </mat-card-header>
        <mat-card-content class="card-table-content">
          <table mat-table [dataSource]="sortedCategories" matSort (matSortChange)="sortCategories($event)" class="data-table">
            <ng-container matColumnDef="category">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Category</th>
              <td mat-cell *matCellDef="let s">
                <span class="cat-title">{{ s.category }}</span>
              </td>
            </ng-container>

            <ng-container matColumnDef="inStockCount">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>In Stock</th>
              <td mat-cell *matCellDef="let s">
                {{ s.inStockCount }} / {{ s.totalListings }}
              </td>
            </ng-container>

            <ng-container matColumnDef="averageDiscountPctAllInStock">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Avg Discount</th>
              <td mat-cell *matCellDef="let s">
                -{{ s.averageDiscountPctAllInStock.toFixed(2) }}%
              </td>
            </ng-container>

            <ng-container matColumnDef="bestEffectiveDeal">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>#1 Best Deal on Page</th>
              <td mat-cell *matCellDef="let s">
                <span *ngIf="s.bestDeal" class="deal-pill">
                  -{{ s.bestDeal.discountPct.toFixed(2) }}% ({{ s.bestDeal.title }})
                </span>
                <span *ngIf="!s.bestDeal" class="muted">—</span>
              </td>
            </ng-container>

            <ng-container matColumnDef="offersCount">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Competing Sellers</th>
              <td mat-cell *matCellDef="let s">
                <button
                  *ngIf="s.bestDealOffers?.length"
                  mat-stroked-button
                  color="accent"
                  class="btn-xs"
                  (click)="openOffers(s)"
                >
                  🏪 View {{ s.bestDealOffers.length }} Offers
                </button>
                <span *ngIf="!s.bestDealOffers?.length" class="muted">No competing offers</span>
              </td>
            </ng-container>

            <ng-container matColumnDef="scrapedAt">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Last Scraped</th>
              <td mat-cell *matCellDef="let s">
                {{ formatDate(s.scrapedAt) }}
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="categoryColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: categoryColumns;"></tr>
          </table>
        </mat-card-content>
      </mat-card>

      <!-- Top Deals Table -->
      <mat-card class="main-card" appearance="outlined">
        <mat-card-header class="table-header">
          <div>
            <mat-card-title>Eneba Top {{ topDealsLimit }} Ranked Gift Card Deals</mat-card-title>
            <mat-card-subtitle>
              The top {{ topDealsLimit }} highest discount deals across monitored categories. Click any column header to sort.
            </mat-card-subtitle>
          </div>
          <div class="filter-controls">
            <mat-form-field appearance="outline" class="search-field">
              <mat-label>Filter cards...</mat-label>
              <input matInput [(ngModel)]="searchQuery" (ngModelChange)="applyDealsFilter()" placeholder="e.g. PSN 100" />
            </mat-form-field>
            <mat-form-field appearance="outline" class="select-field">
              <mat-label>Category</mat-label>
              <mat-select [(ngModel)]="selectedCategory" (selectionChange)="applyDealsFilter()">
                <mat-option value="all">All Eneba Categories</mat-option>
                <mat-option *ngFor="let cat of availableCategories" [value]="cat">{{ cat }}</mat-option>
              </mat-select>
            </mat-form-field>
          </div>
        </mat-card-header>
        <mat-card-content class="card-table-content">
          <table mat-table [dataSource]="filteredDeals" matSort (matSortChange)="sortDeals($event)" class="data-table">
            <ng-container matColumnDef="rank">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Rank</th>
              <td mat-cell *matCellDef="let deal; let i = index">
                <span class="rank-badge">#{{ i + 1 }}</span>
              </td>
            </ng-container>

            <ng-container matColumnDef="title">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Product Title</th>
              <td mat-cell *matCellDef="let deal">
                <span class="deal-title">{{ deal.title }}</span>
              </td>
            </ng-container>

            <ng-container matColumnDef="category">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Category</th>
              <td mat-cell *matCellDef="let deal">{{ deal.category }}</td>
            </ng-container>

            <ng-container matColumnDef="region">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Region</th>
              <td mat-cell *matCellDef="let deal">
                <span class="region-badge">{{ deal.region }}</span>
              </td>
            </ng-container>

            <ng-container matColumnDef="sellingPrice">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Selling Price</th>
              <td mat-cell *matCellDef="let deal" class="price-cell">
                \${{ deal.sellingPrice.toFixed(2) }}
              </td>
            </ng-container>

            <ng-container matColumnDef="discountPct">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Discount</th>
              <td mat-cell *matCellDef="let deal">
                <span *ngIf="deal.discountPct > 0" class="disc-badge">-{{ deal.discountPct.toFixed(1) }}%</span>
                <span *ngIf="!deal.discountPct" class="muted">0%</span>
              </td>
            </ng-container>

            <ng-container matColumnDef="scrapedAt">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Scraped At</th>
              <td mat-cell *matCellDef="let deal">{{ formatDate(deal.scrapedAt) }}</td>
            </ng-container>

            <ng-container matColumnDef="url">
              <th mat-header-cell *matHeaderCellDef>Eneba Link</th>
              <td mat-cell *matCellDef="let deal">
                <a [href]="deal.url" target="_blank" rel="noopener" mat-stroked-button color="primary" class="btn-xs">
                  Buy ↗
                </a>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="dealColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: dealColumns;"></tr>
          </table>
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
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1rem;
    }
    .kpi-card {
      background: var(--mat-sys-surface-container);
      border-radius: 12px;
    }
    .kpi-value {
      font-size: 2rem;
      font-weight: 800;
      color: var(--mat-sys-primary);
      margin: 0.25rem 0;
      &.best-pct {
        color: #10b981;
      }
    }
    .kpi-sub {
      font-size: 0.8rem;
      color: var(--mat-sys-on-surface-variant);
      &.truncate {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }
    .eneba-action-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
      padding: 0.25rem 0;
    }
    .config-summary-pill {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-size: 0.88rem;
      color: var(--mat-sys-on-surface-variant);
    }
    .schema-badge {
      font-size: 0.75rem;
      padding: 0.2rem 0.5rem;
      border-radius: 6px;
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
      font-weight: 700;
    }
    .action-buttons {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }
    .action-btn {
      display: inline-flex !important;
      align-items: center !important;
      gap: 0.35rem !important;
    }
    .btn-icon {
      font-size: 1.15rem !important;
    }
    .main-card {
      background: var(--mat-sys-surface-container);
      border-radius: 12px;
    }
    .table-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
    }
    .filter-controls {
      display: flex;
      gap: 0.75rem;
      align-items: center;
      flex-wrap: wrap;
    }
    .search-field {
      width: 200px;
      margin-bottom: -1.25em;
    }
    .select-field {
      width: 180px;
      margin-bottom: -1.25em;
    }
    .card-table-content {
      padding: 0 !important;
      overflow-x: auto;
    }
    .data-table {
      width: 100%;
      background: transparent;
    }
    .cat-title {
      font-weight: 700;
    }
    .effective-cell {
      font-weight: 700;
      color: #10b981;
    }
    .price-cell {
      font-weight: 700;
      color: var(--mat-sys-primary);
    }
    .deal-pill {
      font-weight: 600;
      color: var(--mat-sys-primary);
    }
    .rank-badge {
      font-weight: 800;
      color: var(--mat-sys-outline);
    }
    .region-badge {
      font-size: 0.75rem;
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
      background: var(--mat-sys-surface-container-high);
    }
    .disc-badge {
      font-weight: 700;
      color: #f59e0b;
    }
    .btn-xs {
      font-size: 0.78rem;
      padding: 0 0.6rem;
      height: 28px;
    }
    .muted {
      color: var(--mat-sys-outline);
    }
  `],
})
export class EnebaComponent {
  categoryColumns: string[] = [
    'category',
    'inStockCount',
    'averageDiscountPctAllInStock',
    'bestEffectiveDeal',
    'offersCount',
    'scrapedAt',
  ];

  dealColumns: string[] = [
    'rank',
    'title',
    'category',
    'region',
    'sellingPrice',
    'discountPct',
    'scrapedAt',
    'url',
  ];

  topDealsLimit = 10;
  alertThresholdPct = 20;
  searchQuery = '';
  selectedCategory = 'all';

  sortedCategories: PageDealStatus[] = [];
  allDeals: (RankedDeal & { scrapedAt?: string })[] = [];
  filteredDeals: (RankedDeal & { scrapedAt?: string })[] = [];
  availableCategories: string[] = [];

  constructor(
    private apiService: ApiService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {}

  ngDoCheck() {
    this.syncData();
  }

  private syncData() {
    const data = this.apiService.dashboardData();
    if (!data) return;

    if (data.enebaConfig) {
      if (data.enebaConfig['top_deals_limit']) {
        this.topDealsLimit = Number(data.enebaConfig['top_deals_limit']) || 10;
      }
      if (data.enebaConfig['alert_discount_threshold_pct']) {
        this.alertThresholdPct = Number(data.enebaConfig['alert_discount_threshold_pct']) || 20;
      }
    }

    const statuses = data.statuses || [];
    this.sortedCategories = [...statuses];

    // Gather categories
    this.availableCategories = Array.from(new Set(statuses.map((s) => s.category)));

    // Gather all ranked deals across all categories
    const collected: (RankedDeal & { scrapedAt?: string })[] = [];
    for (const st of statuses) {
      const deals = st.rankedDeals || st.topDeals || [];
      for (const d of deals) {
        collected.push({ ...d, scrapedAt: st.scrapedAt });
      }
    }

    // Sort by discountPct descending by default (highest discount first)
    collected.sort((a, b) => b.discountPct - a.discountPct);
    this.allDeals = collected;
    this.applyDealsFilter();
  }

  categoriesCount(): number {
    return this.apiService.dashboardData()?.statuses?.length || 5;
  }

  totalInStock(): number {
    return (this.apiService.dashboardData()?.statuses || []).reduce((acc, s) => acc + (s.inStockCount || 0), 0);
  }

  totalDiscounted(): number {
    return (this.apiService.dashboardData()?.statuses || []).reduce((acc, s) => acc + (s.discountedCount || 0), 0);
  }

  bestDealPct(): string {
    const statuses = this.apiService.dashboardData()?.statuses || [];
    const maxDisc = Math.max(...statuses.map((s) => s.maxDiscountPct || 0), 0);
    return maxDisc > 0 ? `-${maxDisc.toFixed(1)}%` : '—';
  }

  bestDealTitle(): string {
    const statuses = this.apiService.dashboardData()?.statuses || [];
    let best: RankedDeal | null = null;
    for (const s of statuses) {
      const candidate = s.bestDeal || s.bestEffectiveDeal;
      if (candidate) {
        if (!best || candidate.discountPct > best.discountPct) {
          best = candidate;
        }
      }
    }
    return best?.title || 'No active deals';
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString();
  }

  openEnebaConfigModal() {
    const dialogRef = this.dialog.open(EnebaConfigDialogComponent, {
      data: {
        topDealsLimit: this.topDealsLimit,
        alertThresholdPct: this.alertThresholdPct,
      },
      width: '500px',
    });

    dialogRef.afterClosed().subscribe((res) => {
      if (res) {
        this.topDealsLimit = res.topDealsLimit;
        this.alertThresholdPct = res.alertThresholdPct;
        this.saveEnebaConfig();
      }
    });
  }

  saveEnebaConfig() {
    this.apiService
      .updateEnebaConfig({
        top_deals_limit: String(this.topDealsLimit),
        alert_discount_threshold_pct: String(this.alertThresholdPct),
      })
      .subscribe(() => {
        this.snackBar.open('Eneba configuration saved successfully!', 'OK', { duration: 3000 });
      });
  }

  triggerScrape() {
    this.apiService.triggerScrape({}).subscribe(() => {
      this.snackBar.open('Scrape triggered across enabled pages!', 'OK', { duration: 3000 });
    });
  }

  openOffers(status: PageDealStatus) {
    this.dialog.open(SellerOffersDialogComponent, {
      data: {
        title: status.bestEffectiveDeal?.title || status.category,
        offers: status.bestDealOffers || [],
      },
      width: '720px',
    });
  }

  applyDealsFilter() {
    const q = this.searchQuery.trim().toLowerCase();
    const cat = this.selectedCategory;

    const matched = this.allDeals.filter((deal) => {
      const matchCat = cat === 'all' || deal.category === cat;
      const matchQ =
        !q ||
        deal.title.toLowerCase().includes(q) ||
        deal.region.toLowerCase().includes(q) ||
        deal.category.toLowerCase().includes(q);
      return matchCat && matchQ;
    });

    // matched is already sorted by highest discount descending (b.discountPct - a.discountPct)
    // Only show the top N with the highest discount across matching pages
    this.filteredDeals = matched.slice(0, this.topDealsLimit);
  }

  sortCategories(sort: Sort) {
    const data = [...this.sortedCategories];
    if (!sort.active || sort.direction === '') {
      this.sortedCategories = data;
      return;
    }

    this.sortedCategories = data.sort((a, b) => {
      const isAsc = sort.direction === 'asc';
      switch (sort.active) {
        case 'category': return compare(a.category, b.category, isAsc);
        case 'inStockCount': return compare(a.inStockCount, b.inStockCount, isAsc);
        case 'averageDiscountPctAllInStock': return compare(a.averageDiscountPctAllInStock, b.averageDiscountPctAllInStock, isAsc);
        case 'offersCount': return compare(a.bestDealOffers?.length || 0, b.bestDealOffers?.length || 0, isAsc);
        case 'scrapedAt': return compare(a.scrapedAt, b.scrapedAt, isAsc);
        default: return 0;
      }
    });
  }

  sortDeals(sort: Sort) {
    if (!sort.active || sort.direction === '') {
      this.applyDealsFilter();
      return;
    }

    const data = [...this.filteredDeals];
    this.filteredDeals = data.sort((a, b) => {
      const isAsc = sort.direction === 'asc';
      switch (sort.active) {
        case 'rank': return compare(this.filteredDeals.indexOf(a), this.filteredDeals.indexOf(b), isAsc);
        case 'title': return compare(a.title, b.title, isAsc);
        case 'category': return compare(a.category, b.category, isAsc);
        case 'region': return compare(a.region, b.region, isAsc);
        case 'sellingPrice': return compare(a.sellingPrice, b.sellingPrice, isAsc);
        case 'discountPct': return compare(a.discountPct, b.discountPct, isAsc);
        case 'scrapedAt': return compare(a.scrapedAt || '', b.scrapedAt || '', isAsc);
        default: return 0;
      }
    });
  }
}

function compare(a: number | string, b: number | string, isAsc: boolean) {
  return (a < b ? -1 : 1) * (isAsc ? 1 : -1);
}
