import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import * as echarts from 'echarts';
import { ApiService } from '../../core/services/api.service';
import { ThemeService } from '../../core/services/theme.service';
import { SellerOffersDialogComponent } from '../../dialogs/seller-offers-dialog.component';
import { EnebaConfigDialogComponent } from '../../dialogs/eneba-config-dialog.component';
import type { PageDealStatus, RankedDeal, SellerOffer, ScrapeHistoryItem } from '../../core/models/dashboard.model';

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
    MatIconModule,
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

        <mat-card class="kpi-card controls-card" appearance="outlined">
          <mat-card-header>
            <mat-card-subtitle>Provider Controls</mat-card-subtitle>
            <mat-card-title class="kpi-value kpi-controls-value">
              Pull: {{ topDealsLimit }} • Alert: {{ alertThresholdPct }}%
            </mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="kpi-controls-actions">
              <button mat-stroked-button type="button" class="action-btn" (click)="openEnebaConfigModal()">
                <mat-icon class="btn-icon">settings</mat-icon>
                <span>Configuration</span>
              </button>
              <button mat-flat-button color="primary" type="button" class="action-btn" (click)="triggerScrape()">
                <mat-icon class="btn-icon">play_arrow</mat-icon>
                <span>Scrape Now</span>
              </button>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Eneba Mid Section: Categories Table (Left) + Best Discount in History Chart (Right) -->
      <div class="mid-section-grid">
        <!-- Category Summary Table -->
        <mat-card class="main-card half-card" appearance="outlined">
          <mat-card-header class="table-header">
            <div>
              <mat-card-title>Eneba Gift Card Categories — Status &amp; Seller Offers</mat-card-title>
              <mat-card-subtitle>
                Category-specific metrics including discount percentages and competing merchant offers. Click any column header to sort.
              </mat-card-subtitle>
            </div>
          </mat-card-header>
          <mat-card-content class="card-table-content">
            <div class="table-wrapper">
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
                    <span class="badge badge-muted">{{ s.inStockCount }} / {{ s.totalListings }}</span>
                  </td>
                </ng-container>

                <ng-container matColumnDef="averageDiscountPctAllInStock">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header>Avg Discount</th>
                  <td mat-cell *matCellDef="let s">
                    <span class="badge badge-discount">-{{ s.averageDiscountPctAllInStock.toFixed(2) }}%</span>
                  </td>
                </ng-container>

                <ng-container matColumnDef="bestEffectiveDeal">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header>#1 Best Deal on Page</th>
                  <td mat-cell *matCellDef="let s">
                    <a *ngIf="s.bestDeal" [href]="s.bestDeal.url" target="_blank" rel="noopener" class="deal-cell-link" [title]="s.bestDeal.title">
                      <span class="badge badge-discount">-{{ s.bestDeal.discountPct.toFixed(2) }}%</span>
                      <strong class="deal-price-text" *ngIf="s.bestDeal.sellingPrice">(\${{ s.bestDeal.sellingPrice.toFixed(2) }})</strong>
                      <span class="deal-title-text">{{ s.bestDeal.title }}</span>
                      <span class="deal-arrow">↗</span>
                    </a>
                    <span *ngIf="!s.bestDeal" class="muted">—</span>
                  </td>
                </ng-container>

                <ng-container matColumnDef="offersCount">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header class="col-offers">Competing Sellers</th>
                  <td mat-cell *matCellDef="let s" class="col-offers">
                    <button
                      *ngIf="s.bestDealOffers?.length"
                      mat-stroked-button
                      class="offers-badge-btn"
                      (click)="openOffers(s)"
                    >
                      <mat-icon class="offers-mat-icon">storefront</mat-icon>
                      <span>View {{ s.bestDealOffers.length }} Offers</span>
                    </button>
                    <span *ngIf="!s.bestDealOffers?.length" class="muted">No competing offers</span>
                  </td>
                </ng-container>

                <ng-container matColumnDef="scrapedAt">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header>Last Scraped</th>
                  <td mat-cell *matCellDef="let s" class="scraped-date">
                    {{ formatDate(s.scrapedAt) }}
                  </td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="categoryColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: categoryColumns;"></tr>
              </table>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Best Discount in History Chart -->
        <mat-card class="main-card half-card" appearance="outlined">
          <mat-card-header class="table-header">
            <div>
              <mat-card-title class="chart-header-title">
                <mat-icon class="chart-icon">trending_up</mat-icon>
                <span>Best Discount in History</span>
              </mat-card-title>
              <mat-card-subtitle>
                Historical #1 highest discount across scrape runs. Hover point for seller, cost, and face value.
              </mat-card-subtitle>
            </div>
            <div class="peak-badge-box">
              <span class="peak-label">All-Time Peak:</span>
              <strong class="peak-val">{{ peakDiscountPct() }}</strong>
            </div>
          </mat-card-header>
          <mat-card-content class="chart-card-content">
            <div #bestDiscountChartContainer class="echarts-container" style="height: 320px; width: 100%;"></div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Top Deals Table -->
      <mat-card class="main-card" appearance="outlined">
        <mat-card-header class="table-header">
          <div>
            <mat-card-title>Eneba Top {{ topDealsLimit }} Ranked Gift Card Deals (Latest Scrape)</mat-card-title>
            <mat-card-subtitle>
              Active live deals from the most recent scrape run. Expired deals from older scrapes are excluded.
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
          <div class="table-wrapper">
            <table mat-table [dataSource]="filteredDeals" matSort (matSortChange)="sortDeals($event)" class="data-table">
              <ng-container matColumnDef="rank">
                <th mat-header-cell *matHeaderCellDef mat-sort-header class="col-rank">Rank</th>
                <td mat-cell *matCellDef="let deal; let i = index" class="col-rank">
                  <span class="badge-rank">#{{ i + 1 }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="title">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Product Title</th>
                <td mat-cell *matCellDef="let deal">
                  <div class="deal-title-wrapper">
                    <span class="deal-title">{{ deal.title }}</span>
                    <span *ngIf="deal.discountPct >= alertThresholdPct" class="badge badge-alert" title="Meets email alert threshold">
                      🔥 ≥{{ alertThresholdPct }}%
                    </span>
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="category">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Category</th>
                <td mat-cell *matCellDef="let deal">
                  <span class="badge badge-muted">{{ deal.category }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="region">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Region</th>
                <td mat-cell *matCellDef="let deal">
                  <span class="badge-region">{{ deal.region }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="sellingPrice">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Selling Price</th>
                <td mat-cell *matCellDef="let deal" class="price-cell">
                  <strong>\${{ deal.sellingPrice.toFixed(2) }}</strong>
                  <span *ngIf="deal.originalPrice && deal.originalPrice > deal.sellingPrice" class="strike-price">
                    \${{ deal.originalPrice.toFixed(2) }}
                  </span>
                </td>
              </ng-container>

              <ng-container matColumnDef="discountPct">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Discount</th>
                <td mat-cell *matCellDef="let deal">
                  <span *ngIf="deal.discountPct > 0" class="badge badge-discount">-{{ deal.discountPct.toFixed(1) }}%</span>
                  <span *ngIf="!deal.discountPct" class="muted">0%</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="scrapedAt">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Scraped At</th>
                <td mat-cell *matCellDef="let deal" class="scraped-date">{{ formatDate(deal.scrapedAt) }}</td>
              </ng-container>

              <ng-container matColumnDef="url">
                <th mat-header-cell *matHeaderCellDef class="col-buy">Eneba Link</th>
                <td mat-cell *matCellDef="let deal" class="col-buy">
                  <a [href]="deal.url" target="_blank" rel="noopener" mat-stroked-button color="primary" class="btn-xs buy-btn">
                    <span>Buy ↗</span>
                  </a>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="dealColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: dealColumns;"></tr>
            </table>
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
    .controls-card {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .kpi-controls-value {
      font-size: 1.05rem !important;
      font-weight: 700;
      color: var(--mat-sys-on-surface);
      margin: 0.25rem 0;
    }
    .kpi-controls-actions {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      margin-top: 0.5rem;
      .action-btn {
        flex: 1;
        white-space: nowrap;
      }
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
      padding: 0 1.25rem 1.25rem !important;
      overflow-x: auto;
    }
    .data-table {
      width: 100%;
      background: transparent;
    }
    .cat-title {
      font-weight: 700;
      color: var(--mat-sys-on-surface);
    }
    .deal-title-wrapper {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      flex-wrap: wrap;
    }
    .deal-title {
      font-weight: 600;
      color: var(--mat-sys-on-surface);
    }
    .deal-cell-link {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      text-decoration: none;
      color: var(--mat-sys-on-surface);
      max-width: 320px;
      line-height: 1.3;

      &:hover {
        .deal-title-text {
          text-decoration: underline;
          color: var(--mat-sys-primary);
        }
      }
    }
    .deal-price-text {
      color: var(--mat-sys-primary);
      font-size: 0.82rem;
      font-weight: 700;
      white-space: nowrap;
    }
    .deal-title-text {
      font-size: 0.82rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 160px;
    }
    .deal-arrow {
      color: var(--mat-sys-primary);
      font-size: 0.82rem;
      font-weight: 700;
    }
    .scraped-date {
      font-size: 0.78rem;
      color: var(--mat-sys-on-surface-variant);
      white-space: nowrap;
    }
    .col-rank {
      width: 55px !important;
      text-align: center;
    }
    .price-cell {
      font-weight: 700;
      color: var(--mat-sys-on-surface);
      white-space: nowrap;
    }
    .btn-xs {
      font-size: 0.78rem;
      padding: 0 0.65rem;
      height: 28px;
      line-height: 28px;
      white-space: nowrap !important;
    }
    .col-offers {
      white-space: nowrap !important;
      min-width: 175px !important;
    }
    .offers-badge-btn {
      white-space: nowrap !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 0.35rem !important;
      height: 28px !important;
      line-height: 28px !important;
      padding: 0 0.75rem !important;
      font-size: 0.78rem !important;
      font-weight: 600 !important;
      border-radius: 6px !important;
      border: 1px solid rgba(99, 102, 241, 0.4) !important;
      background: rgba(99, 102, 241, 0.08) !important;
      color: var(--mat-sys-primary) !important;
      min-width: max-content !important;
      flex-shrink: 0 !important;
      cursor: pointer !important;
      transition: all 0.15s ease !important;

      &:hover {
        background: rgba(99, 102, 241, 0.18) !important;
        border-color: var(--mat-sys-primary) !important;
      }

      .offers-mat-icon {
        font-size: 16px !important;
        width: 16px !important;
        height: 16px !important;
        line-height: 16px !important;
        vertical-align: middle !important;
      }

      span {
        white-space: nowrap !important;
        line-height: 1 !important;
      }
    }
    .col-buy {
      white-space: nowrap !important;
      width: 90px !important;
    }
    .buy-btn {
      white-space: nowrap !important;
      font-weight: 600 !important;
      border-radius: 6px !important;
    }
    .muted {
      color: var(--mat-sys-outline);
    }
    .mid-section-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(460px, 1fr));
      gap: 1.5rem;
      align-items: stretch;
    }
    .half-card {
      display: flex;
      flex-direction: column;
    }
    .chart-header-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .chart-icon {
      color: #10b981;
      font-size: 1.35rem;
    }
    .peak-badge-box {
      font-size: 0.85rem;
      background: var(--mat-sys-surface-container-high);
      padding: 0.35rem 0.75rem;
      border-radius: 8px;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }
    .peak-label {
      color: var(--mat-sys-on-surface-variant);
    }
    .peak-val {
      color: #10b981;
      font-weight: 700;
    }
    .chart-card-content {
      flex: 1;
      min-height: 320px;
      padding: 0.5rem 1rem 1rem !important;
    }
    .echarts-container {
      width: 100%;
      height: 100%;
    }
  `],
})
export class EnebaComponent implements AfterViewInit, OnDestroy {
  @ViewChild('bestDiscountChartContainer') bestDiscountChartContainerRef?: ElementRef<HTMLDivElement>;
  private chartInstance?: echarts.ECharts;
  private resizeObserver?: ResizeObserver;
  private lastDataRef?: any;

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
    private themeService: ThemeService,
    @Inject(PLATFORM_ID) private platformId: object,
  ) {}

  ngAfterViewInit() {
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => this.renderBestDiscountChart(), 50);
    }
  }

  ngOnDestroy() {
    this.resizeObserver?.disconnect();
    this.chartInstance?.dispose();
  }

  ngDoCheck() {
    const data = this.apiService.dashboardData();
    if (data !== this.lastDataRef) {
      this.lastDataRef = data;
      this.syncData();
    }
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

    if (isPlatformBrowser(this.platformId)) {
      this.renderBestDiscountChart();
    }
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

  peakDiscountPct(): string {
    const data = this.apiService.dashboardData();
    const history = data?.history || [];
    const statuses = data?.statuses || [];
    let maxPct = 0;

    for (const h of history) {
      if (h.bestDeal && h.bestDeal.discountPct > maxPct) {
        maxPct = h.bestDeal.discountPct;
      }
    }
    for (const s of statuses) {
      const d = s.bestDeal || s.bestEffectiveDeal;
      if (d && d.discountPct > maxPct) {
        maxPct = d.discountPct;
      }
    }

    return maxPct > 0 ? `-${maxPct.toFixed(1)}%` : '—';
  }

  private renderBestDiscountChart(): void {
    if (!this.bestDiscountChartContainerRef?.nativeElement) return;

    const data = this.apiService.dashboardData();
    const history = data?.history || [];
    const statuses = data?.statuses || [];

    let items = history.filter((h) => h.bestDeal || (h.totalListings && h.totalListings > 0));

    if (items.length === 0 && statuses.length > 0) {
      let bestItem: {
        title: string;
        category: string;
        sellerName: string;
        cost: number;
        faceValue: number;
        discountPct: number;
        url?: string;
      } | null = null;
      let highest = -1;

      for (const st of statuses) {
        const top = st.bestDeal || st.bestEffectiveDeal || (st.rankedDeals && st.rankedDeals[0]);
        if (top && (top.discountPct || 0) > highest) {
          highest = top.discountPct;
          bestItem = {
            title: top.title,
            category: st.category,
            sellerName: (st.bestDealOffers && st.bestDealOffers[0]?.sellerName) ||
              top.lowestSellerName || 'Top Merchant',
            cost: top.sellingPrice ?? 0,
            faceValue: top.faceValue ?? top.originalPrice ?? 0,
            discountPct: top.discountPct,
            url: top.url,
          };
        }
      }

      if (bestItem) {
        items = [{
          timestamp: statuses[0].scrapedAt,
          totalPages: statuses.length,
          successfulPages: statuses.filter((s) => s.totalListings > 0).length,
          successRate: 100,
          bestDeal: bestItem,
        }];
      }
    }

    if (items.length === 0) {
      this.chartInstance?.dispose();
      this.chartInstance = undefined;
      return;
    }

    if (!this.chartInstance) {
      this.chartInstance = echarts.init(this.bestDiscountChartContainerRef.nativeElement);
      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => {
          this.chartInstance?.resize();
        });
        this.resizeObserver.observe(this.bestDiscountChartContainerRef.nativeElement);
      }
    }

    const currentTheme = this.themeService.themeMode();
    const isDark = currentTheme === 'dark' ||
      (currentTheme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    const resolvedPoints = items.map((it) => {
      let deal = it.bestDeal;
      if (!deal && statuses.length > 0) {
        const fallback = statuses[0].bestDeal || statuses[0].bestEffectiveDeal;
        if (fallback) {
          deal = {
            title: fallback.title,
            category: statuses[0].category,
            sellerName: (statuses[0].bestDealOffers && statuses[0].bestDealOffers[0]?.sellerName) || 'Top Merchant',
            cost: fallback.sellingPrice,
            faceValue: fallback.faceValue ?? 0,
            discountPct: fallback.discountPct,
          };
        }
      }
      const pct = deal ? Number((deal.discountPct || 0).toFixed(1)) : 0;
      return { it, deal, pct };
    });

    const categories = resolvedPoints.map((p, idx) => {
      const d = new Date(p.it.timestamp);
      if (isNaN(d.getTime())) return `Run #${idx + 1}`;
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    });

    const values = resolvedPoints.map((p) => p.pct);

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      animationDuration: 500,
      grid: {
        top: 24,
        right: 20,
        bottom: 28,
        left: 45,
        containLabel: false,
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: isDark ? '#1e293b' : '#ffffff',
        borderColor: isDark ? '#334155' : '#cbd5e1',
        borderWidth: 1,
        textStyle: {
          color: isDark ? '#f8fafc' : '#0f172a',
          fontSize: 12,
        },
        padding: [10, 14],
        extraCssText: 'box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2), 0 4px 6px -2px rgba(0, 0, 0, 0.1); border-radius: 8px; z-index: 100;',
        axisPointer: {
          type: 'cross',
          lineStyle: {
            color: '#10b981',
            type: 'dashed',
          },
          crossStyle: {
            color: '#10b981',
          },
        },
        formatter: (params: any) => {
          if (!Array.isArray(params) || !params.length) return '';
          const p = params[0];
          const idx = p.dataIndex;
          const point = resolvedPoints[idx];
          if (!point) return '';
          const it = point.it;
          const d = point.deal;
          const fullTime = isNaN(new Date(it.timestamp).getTime())
            ? 'Recent Scrape'
            : new Date(it.timestamp).toLocaleString();
          if (!d) {
            return `<div style="font-weight:600;">🕒 ${escapeHtml(fullTime)}</div><div>Discount: <strong>${p.value}%</strong></div>`;
          }
          const costStr = d.cost != null ? '$' + Number(d.cost).toFixed(2) : 'N/A';
          const faceStr = d.faceValue != null ? '$' + Number(d.faceValue).toFixed(2) : 'N/A';
          const discountStr = (d.discountPct || p.value || 0).toFixed(1) + '%';
          const sellerStr = d.sellerName || 'Top Merchant';
          return `
            <div style="font-weight:700;margin-bottom:6px;color:${isDark ? '#f8fafc' : '#0f172a'};">
              🕒 ${escapeHtml(fullTime)}
            </div>
            <div style="font-size:12.5px;font-weight:600;color:#10b981;margin-bottom:6px;line-height:1.3;">
              🏷️ ${escapeHtml(d.title)} ${d.category ? `<span style="font-size:11px;opacity:0.85;">(${escapeHtml(d.category)})</span>` : ''}
            </div>
            <div style="display:grid;grid-template-columns:auto auto;gap:4px 14px;font-size:12px;margin-top:6px;border-top:1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'};padding-top:6px;">
              <span style="color:${isDark ? '#94a3b8' : '#64748b'};">Seller / Merchant:</span>
              <strong>${escapeHtml(sellerStr)}</strong>
              <span style="color:${isDark ? '#94a3b8' : '#64748b'};">Exact Cost:</span>
              <strong style="color:#10b981;">${escapeHtml(costStr)}</strong>
              <span style="color:${isDark ? '#94a3b8' : '#64748b'};">Face Value:</span>
              <strong>${escapeHtml(faceStr)}</strong>
              <span style="color:${isDark ? '#94a3b8' : '#64748b'};">Calculated Discount:</span>
              <strong style="color:#10b981;">${escapeHtml(discountStr)} off</strong>
            </div>
          `;
        },
      },
      xAxis: {
        type: 'category',
        data: categories,
        boundaryGap: false,
        axisLine: {
          lineStyle: { color: isDark ? '#334155' : '#e2e8f0' },
        },
        axisTick: { show: false },
        axisLabel: {
          color: isDark ? '#94a3b8' : '#64748b',
          fontSize: 11,
        },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: (val: { max: number }) => Math.max(Math.ceil((val.max + 5) / 5) * 5, 25),
        axisLabel: {
          formatter: '{value}%',
          color: isDark ? '#94a3b8' : '#64748b',
          fontSize: 11,
        },
        splitLine: {
          lineStyle: {
            color: isDark ? 'rgba(51, 65, 85, 0.4)' : 'rgba(226, 232, 240, 0.8)',
            type: 'dashed',
          },
        },
      },
      series: [
        {
          name: 'Best Discount %',
          type: 'line',
          smooth: true,
          showSymbol: items.length < 35,
          symbol: 'circle',
          symbolSize: 7,
          itemStyle: {
            color: '#10b981',
            borderWidth: 2,
            borderColor: isDark ? '#0f172a' : '#ffffff',
          },
          lineStyle: {
            width: 3,
            color: '#10b981',
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(16, 185, 129, 0.42)' },
                { offset: 1, color: 'rgba(16, 185, 129, 0.02)' },
              ],
            },
          },
          data: values,
        },
      ],
    };

    this.chartInstance.setOption(option, true);
    this.chartInstance.resize();
  }
}

function compare(a: number | string, b: number | string, isAsc: boolean) {
  return (a < b ? -1 : 1) * (isAsc ? 1 : -1);
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
