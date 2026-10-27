import { Component, ElementRef, ViewChild, OnInit, AfterViewInit, OnDestroy, Inject, PLATFORM_ID, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
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
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import * as echarts from 'echarts';
import { ApiService } from '../../core/services/api.service';
import { ThemeService } from '../../core/services/theme.service';
import { SellerOffersDialogComponent } from '../../dialogs/seller-offers-dialog.component';
import { EnebaConfigDialogComponent } from '../../dialogs/eneba-config-dialog.component';
import type { PageDealStatus, RankedDeal, SellerOffer, ScrapeHistoryItem, ScrapePageConfig, SchedulerState } from '../../core/models/dashboard.model';

@Component({
  selector: 'app-eneba',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
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
    MatTooltipModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="page-container">
      <!-- Provider KPIs -->
      <div class="kpi-grid">
        <!-- Card 1: Categories (Indigo / Violet) -->
        <mat-card class="kpi-card kpi-indigo" appearance="outlined">
          <div class="kpi-top-bar"></div>
          <div class="kpi-card-inner">
            <div class="kpi-header-row">
              <span class="kpi-eyebrow">{{ providerDisplayName }} Store Categories</span>
              <div class="kpi-icon-pill">
                <mat-icon>category</mat-icon>
              </div>
            </div>
            <div class="kpi-value-row">
              <span class="kpi-metric-num">{{ categoriesCount() }}</span>
              <span class="kpi-unit-badge">monitored</span>
            </div>
            <div class="kpi-chips-row">
              <span class="kpi-mini-chip" *ngFor="let name of activeTargetNames | slice:0:5">{{ name }}</span>
              <span class="kpi-mini-chip" *ngIf="activeTargetNames.length === 0">{{ providerDisplayName }}</span>
            </div>
          </div>
        </mat-card>

        <!-- Card 2: Cards In Stock (Sky Blue / Cyan) -->
        <mat-card class="kpi-card kpi-cyan" appearance="outlined">
          <div class="kpi-top-bar"></div>
          <div class="kpi-card-inner">
            <div class="kpi-header-row">
              <span class="kpi-eyebrow">{{ providerDisplayName }} Cards In Stock</span>
              <div class="kpi-icon-pill">
                <mat-icon>inventory_2</mat-icon>
              </div>
            </div>
            <div class="kpi-value-row">
              <span class="kpi-metric-num">{{ totalInStock() }}</span>
              <span class="kpi-unit-badge">active cards</span>
            </div>
            <div class="kpi-sub-row">
              <span class="kpi-highlight-pill">
                <mat-icon class="pill-icon">local_fire_department</mat-icon>
                <strong>{{ totalDiscounted() }}</strong> with direct discount
              </span>
            </div>
          </div>
        </mat-card>

        <!-- Card 3: Best Deal (Emerald / Mint) -->
        <mat-card class="kpi-card kpi-emerald" appearance="outlined">
          <div class="kpi-top-bar"></div>
          <div class="kpi-card-inner">
            <div class="kpi-header-row">
              <span class="kpi-eyebrow">Best {{ providerDisplayName }} Deal</span>
              <div class="kpi-icon-pill" matTooltip="Top deals with the highest discounts">
                <mat-icon>north_east</mat-icon>
              </div>
            </div>
            <div class="kpi-value-row">
              <span class="kpi-metric-num kpi-deal-pct">{{ bestDealPct() }}</span>
              <span class="kpi-unit-badge kpi-unit-emerald">max discount</span>
            </div>
            <div class="kpi-best-deals-list" *ngIf="topBestDeals.length > 0">
              <a
                *ngFor="let deal of topBestDeals"
                [href]="deal.url"
                target="_blank"
                rel="noopener"
                class="kpi-deal-row-link"
                [title]="deal.title"
              >
                <div class="kpi-deal-row-left">
                  <span class="badge badge-discount-peak kpi-deal-badge" *ngIf="deal.discountPct > 0">-{{ deal.discountPct.toFixed(1) }}%</span>
                  <span class="badge badge-muted kpi-deal-badge" *ngIf="!deal.discountPct || deal.discountPct <= 0">Top Deal</span>
                  <span class="kpi-deal-row-title truncate">{{ deal.title }}</span>
                </div>
                <div class="kpi-deal-row-right">
                  <span class="kpi-deal-price" *ngIf="deal.sellingPrice && deal.sellingPrice > 0">\${{ deal.sellingPrice.toFixed(2) }}</span>
                  <mat-icon class="kpi-deal-arrow">north_east</mat-icon>
                </div>
              </a>
            </div>
            <div class="kpi-deal-title-box truncate" *ngIf="topBestDeals.length === 0">
              <mat-icon class="deal-icon">info</mat-icon>
              <span class="deal-name">No active deals</span>
            </div>
          </div>
        </mat-card>

        <!-- Card 4: Provider Controls (Violet / Purple) -->
        <mat-card class="kpi-card kpi-purple controls-card" appearance="outlined">
          <div class="kpi-top-bar"></div>
          <div class="kpi-card-inner">
            <div class="kpi-header-row">
              <span class="kpi-eyebrow">Provider Controls</span>
              <div class="kpi-icon-pill">
                <mat-icon>tune</mat-icon>
              </div>
            </div>
            <div class="kpi-telemetry-box">
              <div class="telemetry-item">
                <span class="telemetry-label">Pull Limit</span>
                <span class="telemetry-val">{{ topDealsLimit }} <small>per cat</small></span>
              </div>
              <div class="telemetry-sep"></div>
              <div class="telemetry-item">
                <span class="telemetry-label">Alert Gate</span>
                <span class="telemetry-val">&ge; {{ alertThresholdPct }}%</span>
              </div>
            </div>
            <div class="kpi-actions-row">
              <button mat-stroked-button type="button" class="kpi-btn-config" (click)="openEnebaConfigModal()">
                <mat-icon class="btn-mat-icon">settings</mat-icon>
                <span>Config</span>
              </button>
              <button mat-flat-button color="primary" type="button" class="kpi-btn-scrape" (click)="triggerScrape()">
                <mat-icon class="btn-mat-icon">play_arrow</mat-icon>
                <span>Scrape Now</span>
              </button>
            </div>
          </div>
        </mat-card>
      </div>

      <!-- Eneba Mid Section: Categories Table (Left) + Best Discount in History Chart (Right) -->
      <div class="mid-section-grid">
        <!-- Category Summary Table -->
        <mat-card class="main-card half-card" appearance="outlined">
          <mat-card-header class="table-header">
            <div class="table-header-titles">
              <mat-card-title>{{ providerDisplayName }} Categories — Status &amp; Seller Offers</mat-card-title>
              <mat-card-subtitle>
                Category metrics &amp; best discounts. Click row for seller offers; hover for scrape history.
              </mat-card-subtitle>
            </div>
            <div class="table-actions">
              <a mat-stroked-button routerLink="/schedulers" class="action-btn" matTooltip="Configure all schedules and assigned targets">
                <mat-icon>schedule</mat-icon>
                <span>Schedulers</span>
              </a>
            </div>
          </mat-card-header>
          <mat-card-content class="card-table-content table-wrapper-relative">
            <!-- Loading State Overlay -->
            <div *ngIf="isLoading" class="ui-loading-overlay">
              <mat-spinner diameter="34" strokeWidth="3"></mat-spinner>
              <span class="loading-label">Loading category statuses &amp; best offers...</span>
            </div>

            <div class="table-wrapper no-scroll-wrapper" [class.table-loading-dimmed]="isLoading">
              <table mat-table [dataSource]="sortedCategories" matSort (matSortChange)="sortCategories($event)" class="data-table category-table">
                <!-- Category Column -->
                <ng-container matColumnDef="category">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header class="col-cat">Category</th>
                  <td mat-cell *matCellDef="let s" class="col-cat">
                    <span class="cat-title">{{ s.targetName || s.name || s.category }}</span>
                  </td>
                </ng-container>

                <!-- In Stock Column -->
                <ng-container matColumnDef="inStockCount">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header class="col-instock">In Stock</th>
                  <td mat-cell *matCellDef="let s" class="col-instock">
                    <span class="badge badge-muted">{{ s.inStockCount }} / {{ s.totalListings }}</span>
                  </td>
                </ng-container>

                <!-- Avg Discount Column -->
                <ng-container matColumnDef="averageDiscountPctAllInStock">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header class="col-avg">Avg Discount</th>
                  <td mat-cell *matCellDef="let s" class="col-avg">
                    <span class="badge badge-discount" *ngIf="s.averageDiscountPctAllInStock > 0">
                      -{{ s.averageDiscountPctAllInStock.toFixed(1) }}%
                    </span>
                    <span class="muted" *ngIf="!s.averageDiscountPctAllInStock || s.averageDiscountPctAllInStock <= 0">—</span>
                  </td>
                </ng-container>

                <!-- Latest Discount Column -->
                <ng-container matColumnDef="latestDiscount">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header class="col-latest-deal">Latest Discount</th>
                  <td mat-cell *matCellDef="let s" class="col-latest-deal">
                    <a
                      *ngIf="s.bestDeal && s.bestDeal.discountPct > 0"
                      [href]="s.bestDeal.url"
                      target="_blank"
                      rel="noopener"
                      class="deal-cell-link"
                      [title]="s.bestDeal.title"
                      (click)="$event.stopPropagation()"
                    >
                      <span class="badge badge-discount-peak">-{{ s.bestDeal.discountPct.toFixed(1) }}%</span>
                      <strong class="deal-price-text" *ngIf="s.bestDeal.sellingPrice">(\${{ s.bestDeal.sellingPrice.toFixed(2) }})</strong>
                    </a>
                    <span class="muted" *ngIf="!s.bestDeal || s.bestDeal.discountPct <= 0">—</span>
                  </td>
                </ng-container>

                <!-- Seller Offers Column -->
                <ng-container matColumnDef="offersCount">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header class="col-offers">Seller Offers</th>
                  <td mat-cell *matCellDef="let s" class="col-offers">
                    <button
                      *ngIf="s.bestDealOffers && s.bestDealOffers.length > 0"
                      mat-stroked-button
                      type="button"
                      class="offers-badge-btn"
                      (click)="$event.stopPropagation(); openOffers(s)"
                      matTooltip="View {{ s.bestDealOffers.length }} competing seller offers for {{ s.targetName || s.name || s.category }}"
                    >
                      <mat-icon class="offers-btn-icon">groups</mat-icon>
                      <span>{{ s.bestDealOffers.length }} offers</span>
                    </button>
                    <span class="muted" *ngIf="!s.bestDealOffers || s.bestDealOffers.length === 0">—</span>
                  </td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="categoryColumns"></tr>
                <tr
                  mat-row
                  *matRowDef="let row; columns: categoryColumns;"
                  class="category-table-row clickable-row"
                  (click)="openOffers(row)"
                  (mouseenter)="showRowTooltip($event, row)"
                  (mousemove)="moveRowTooltip($event)"
                  (mouseleave)="hideRowTooltip()"
                ></tr>
              </table>
            </div>

            <!-- Rich Category Diagnostics Hover Card / Floating Tooltip -->
            <div
              *ngIf="hoveredRow"
              class="category-hover-card"
              [style.top.px]="tooltipTop"
              [style.left.px]="tooltipLeft"
            >
              <!-- Row 1: Category Header Eyebrow & Scrape Timestamp (0.72rem) -->
              <div class="hover-card-header">
                <span class="hover-cat-badge">{{ hoveredRow.targetName || hoveredRow.name || hoveredRow.category }}</span>
                <span class="hover-time">
                  <mat-icon class="hover-time-icon">schedule</mat-icon>
                  {{ formatDate(hoveredRow.scrapedAt) }}
                </span>
              </div>

              <!-- Deal Content if bestDeal exists -->
              <ng-container *ngIf="hoveredRow.bestDeal">
                <!-- Row 2: Prominent Deal Title (0.94rem bold) -->
                <div class="hover-deal-title">
                  {{ hoveredRow.bestDeal.title }}
                </div>

                <!-- Row 3: Key Metrics Grid (1.05rem / 0.92rem / 0.88rem) -->
                <div class="hover-metrics-grid">
                  <div class="hover-metric-box metric-discount">
                    <span class="metric-label">Best Discount</span>
                    <span class="metric-value">-{{ hoveredRow.bestDeal.discountPct.toFixed(1) }}%</span>
                  </div>
                  <div class="hover-metric-box">
                    <span class="metric-label">Deal Price</span>
                    <span class="metric-value price-val">\${{ hoveredRow.bestDeal.sellingPrice.toFixed(2) }}</span>
                  </div>
                  <div class="hover-metric-box" *ngIf="getSavings(hoveredRow)">
                    <span class="metric-label">You Save</span>
                    <span class="metric-value savings-val">\${{ getSavings(hoveredRow) }}</span>
                  </div>
                </div>

                <!-- Row 4: Merchant / Seller Line (0.78rem) -->
                <div class="hover-seller-row" *ngIf="getSellerName(hoveredRow)">
                  <mat-icon class="hover-row-icon">storefront</mat-icon>
                  <span class="seller-label">Top Merchant:</span>
                  <strong class="seller-name">{{ getSellerName(hoveredRow) }}</strong>
                  <span class="seller-rating" *ngIf="hoveredRow.bestDeal.lowestSellerRating">
                    ★ {{ hoveredRow.bestDeal.lowestSellerRating }}
                  </span>
                </div>
              </ng-container>

              <!-- No Deal Fallback -->
              <div *ngIf="!hoveredRow.bestDeal" class="hover-no-deal">
                No active discount deals currently in stock for this category.
              </div>

              <!-- Row 5: Footer Actions & Competing Offers (0.74rem) -->
              <div class="hover-card-footer">
                <span class="offers-summary">
                  <mat-icon class="footer-icon">groups</mat-icon>
                  {{ hoveredRow.bestDealOffers?.length || 0 }} competing seller offers
                </span>
                <span class="click-hint">Click row to view all offers →</span>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Best Discount in History Chart -->
        <mat-card class="main-card half-card" appearance="outlined">
          <mat-card-header class="table-header">
            <mat-card-title class="chart-header-title">Best Discount in History</mat-card-title>
            <mat-card-subtitle>
              Historical #1 highest discount across scrape runs. Hover point for seller, cost, and face value.
            </mat-card-subtitle>
            <div class="peak-badge-box" *ngIf="!isLoading">
              <span class="peak-label">All-Time Peak:</span>
              <strong class="peak-val">{{ peakDiscountPct() }}</strong>
            </div>
          </mat-card-header>
          <mat-card-content class="chart-card-content chart-wrapper-relative">
            <!-- Loading State Overlay -->
            <div *ngIf="isLoading" class="ui-loading-overlay">
              <mat-spinner diameter="38" strokeWidth="3"></mat-spinner>
              <span class="loading-label">Loading historical discount trends...</span>
            </div>

            <!-- Empty State -->
            <div *ngIf="!isLoading && hasNoChartData" class="empty-chart">
              <mat-icon class="empty-icon">trending_up</mat-icon>
              <p>No historical discount deals recorded yet.</p>
            </div>

            <!-- Chart Container (always mounted with accurate dimensions) -->
            <div
              #bestDiscountChartContainer
              class="echarts-container"
              style="height: 320px; width: 100%;"
              [style.visibility]="!isLoading && !hasNoChartData ? 'visible' : 'hidden'"
            ></div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Top Deals Table -->
      <mat-card class="main-card" appearance="outlined">
        <mat-card-header class="table-header">
          <mat-card-title>{{ providerDisplayName }} Top {{ topDealsLimit }} Ranked Deals (Latest Scrape)</mat-card-title>
          <mat-card-subtitle>
            Active live deals from the most recent scrape run. Expired deals from older scrapes are excluded.
          </mat-card-subtitle>
          <div class="filter-controls">
            <mat-form-field appearance="outline" class="search-field">
              <mat-label>Filter cards...</mat-label>
              <input matInput [(ngModel)]="searchQuery" (ngModelChange)="applyDealsFilter()" placeholder="e.g. PSN 100" />
            </mat-form-field>
            <mat-form-field appearance="outline" class="select-field">
              <mat-label>Category</mat-label>
              <mat-select [(ngModel)]="selectedCategory" (selectionChange)="applyDealsFilter()">
                <mat-option value="all">All</mat-option>
                <mat-option *ngFor="let cat of availableCategories" [value]="cat">{{ cat }}</mat-option>
              </mat-select>
            </mat-form-field>
          </div>
        </mat-card-header>
        <mat-card-content class="card-table-content table-wrapper-relative">
          <!-- Loading State Overlay -->
          <div *ngIf="isLoading" class="ui-loading-overlay">
            <mat-spinner diameter="36" strokeWidth="3"></mat-spinner>
            <span class="loading-label">Loading live ranked gift card deals...</span>
          </div>

          <div class="table-wrapper" [class.table-loading-dimmed]="isLoading">
            <table mat-table [dataSource]="filteredDeals" matSort (matSortChange)="sortDeals($event)" class="data-table deals-table">
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
                  <span class="badge badge-muted">{{ deal.targetName || deal.category }}</span>
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
                <th mat-header-cell *matHeaderCellDef class="col-buy">{{ providerDisplayName }} Link</th>
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
    .category-table {
      width: 100% !important;
      min-width: 520px !important;
      table-layout: auto !important;
    }
    .no-scroll-wrapper {
      overflow-x: auto !important;
      width: 100% !important;
    }
    .clickable-row {
      cursor: pointer;
      transition: background-color 0.15s ease;

      &:hover {
        background-color: var(--mat-sys-surface-container-high) !important;
      }
    }
    .deals-table {
      min-width: 920px !important;
    }
    .col-cat {
      width: 28% !important;
      min-width: 120px !important;
      white-space: nowrap !important;
    }
    .col-instock {
      width: 16% !important;
      min-width: 80px !important;
      white-space: nowrap !important;
    }
    .col-avg {
      width: 18% !important;
      min-width: 80px !important;
      white-space: nowrap !important;
    }
    .col-latest-deal {
      width: 22% !important;
      min-width: 125px !important;
      white-space: nowrap !important;
    }
    .col-offers {
      width: 16% !important;
      min-width: 95px !important;
      white-space: nowrap !important;
    }
    .deal-cell-link {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      text-decoration: none;
      color: var(--mat-sys-on-surface);
      white-space: nowrap !important;
      line-height: 1.3;

      &:hover {
        .deal-price-text {
          text-decoration: underline;
        }
      }
    }
    .offers-badge-btn {
      display: inline-flex !important;
      align-items: center !important;
      gap: 0.3rem !important;
      padding: 0.15rem 0.5rem !important;
      height: 26px !important;
      line-height: 26px !important;
      font-size: 0.76rem !important;
      font-weight: 600 !important;
      border-radius: 6px !important;
      background: rgba(99, 102, 241, 0.08) !important;
      border: 1px solid rgba(99, 102, 241, 0.22) !important;
      color: var(--mat-sys-primary) !important;
      cursor: pointer !important;
      transition: all 0.15s ease !important;

      &:hover {
        background: rgba(99, 102, 241, 0.18) !important;
        border-color: var(--mat-sys-primary) !important;
      }

      .offers-btn-icon {
        font-size: 14px !important;
        width: 14px !important;
        height: 14px !important;
        line-height: 14px !important;
        color: var(--mat-sys-primary) !important;
      }
    }
    .badge-discount-peak {
      background: rgba(16, 185, 129, 0.16);
      color: #10b981;
      border: 1px solid rgba(16, 185, 129, 0.32);
      font-weight: 700;
      font-size: 0.84rem;
      padding: 0.25rem 0.65rem;
      border-radius: 6px;
      display: inline-block;
      letter-spacing: -0.01em;
    }
    .category-table-row {
      cursor: pointer;
      height: 48px;
      transition: background-color 0.15s ease;

      &:nth-child(even) {
        background-color: rgba(255, 255, 255, 0.02);
      }

      &:hover {
        background-color: var(--mat-sys-surface-container-high) !important;
      }
    }
    .category-hover-card {
      position: fixed;
      z-index: 10000;
      pointer-events: none;
      width: 360px;
      max-width: calc(100vw - 32px);
      background: color-mix(in srgb, var(--mat-sys-surface-container-highest, #1e293b) 95%, #0f172a);
      border: 1px solid var(--mat-sys-outline-variant, rgba(255, 255, 255, 0.14));
      border-radius: 12px;
      box-shadow: 0 16px 36px -4px rgba(0, 0, 0, 0.45), 0 6px 16px -2px rgba(0, 0, 0, 0.25);
      padding: 0.95rem 1.15rem;
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      animation: popoverFadeIn 0.12s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes popoverFadeIn {
      from {
        opacity: 0;
        transform: translateY(4px) scale(0.98);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }
    .hover-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.5rem;
      border-bottom: 1px solid var(--mat-sys-outline-variant, rgba(255, 255, 255, 0.08));
      padding-bottom: 0.5rem;
    }
    .hover-cat-badge {
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--mat-sys-primary);
      background: rgba(99, 102, 241, 0.14);
      padding: 0.18rem 0.55rem;
      border-radius: 5px;
    }
    .hover-time {
      display: flex;
      align-items: center;
      gap: 0.3rem;
      font-size: 0.72rem;
      color: var(--mat-sys-on-surface-variant);
      font-weight: 500;
    }
    .hover-time-icon {
      font-size: 0.85rem !important;
      width: 0.85rem !important;
      height: 0.85rem !important;
      opacity: 0.75;
    }
    .hover-deal-title {
      font-size: 0.94rem;
      font-weight: 700;
      line-height: 1.35;
      color: var(--mat-sys-on-surface);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .hover-metrics-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.5rem;
      background: var(--mat-sys-surface-container, rgba(0, 0, 0, 0.15));
      padding: 0.55rem 0.65rem;
      border-radius: 8px;
    }
    .hover-metric-box {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;

      .metric-label {
        font-size: 0.68rem;
        font-weight: 600;
        text-transform: uppercase;
        color: var(--mat-sys-on-surface-variant);
        letter-spacing: 0.02em;
      }

      .metric-value {
        font-size: 0.92rem;
        font-weight: 700;
        color: var(--mat-sys-on-surface);
      }

      &.metric-discount .metric-value {
        color: #10b981;
        font-size: 1.05rem;
      }

      .savings-val {
        color: #10b981;
      }

      .price-val {
        color: var(--mat-sys-on-surface);
      }
    }
    .hover-seller-row {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.78rem;
      color: var(--mat-sys-on-surface-variant);

      .hover-row-icon {
        font-size: 0.95rem !important;
        width: 0.95rem !important;
        height: 0.95rem !important;
        opacity: 0.8;
      }

      .seller-label {
        opacity: 0.85;
      }

      .seller-name {
        color: var(--mat-sys-on-surface);
        font-weight: 600;
      }

      .seller-rating {
        color: #f59e0b;
        font-weight: 600;
        margin-left: 0.2rem;
      }
    }
    .hover-no-deal {
      font-size: 0.82rem;
      color: var(--mat-sys-on-surface-variant);
      font-style: italic;
      padding: 0.4rem 0;
    }
    .hover-card-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid var(--mat-sys-outline-variant, rgba(255, 255, 255, 0.08));
      padding-top: 0.5rem;
      font-size: 0.74rem;

      .offers-summary {
        display: flex;
        align-items: center;
        gap: 0.3rem;
        color: #818cf8;
        font-weight: 600;

        .footer-icon {
          font-size: 0.9rem !important;
          width: 0.9rem !important;
          height: 0.9rem !important;
        }
      }

      .click-hint {
        color: var(--mat-sys-on-surface-variant);
        font-size: 0.7rem;
        font-style: italic;
      }
    }
    .cat-title {
      font-weight: 700;
      color: var(--mat-sys-on-surface);
      white-space: nowrap !important;
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
      white-space: nowrap !important;
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
      white-space: nowrap !important;
    }
    .deal-title-text {
      font-size: 0.82rem;
      white-space: nowrap !important;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 160px;
    }
    .deal-arrow {
      color: var(--mat-sys-primary);
      font-size: 0.82rem;
      font-weight: 700;
      white-space: nowrap !important;
    }
    .scraped-date {
      font-size: 0.78rem;
      color: var(--mat-sys-on-surface-variant);
      white-space: nowrap !important;
    }
    .col-scraped {
      min-width: 120px !important;
      white-space: nowrap !important;
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
      font-size: 1.05rem;
      font-weight: 700;
      text-align: left;
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
export class EnebaComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('bestDiscountChartContainer') bestDiscountChartContainerRef?: ElementRef<HTMLDivElement>;
  private chartInstance?: echarts.ECharts;
  private resizeObserver?: ResizeObserver;
  private lastDataRef?: any;
  private routeSub?: Subscription;

  provider = 'eneba';

  get providerDisplayName(): string {
    if (this.provider === 'g2a') return 'G2A';
    if (this.provider === 'eneba') return 'Eneba';
    return this.provider ? this.provider.charAt(0).toUpperCase() + this.provider.slice(1) : 'Provider';
  }

  get activeTargetNames(): string[] {
    return this.sortedCategories.map((s) => s.targetName || s.name || s.category);
  }

  categoryColumns: string[] = [
    'category',
    'inStockCount',
    'averageDiscountPctAllInStock',
    'latestDiscount',
    'offersCount',
  ];

  dealColumns: string[] = [
    'rank',
    'title',
    'category',
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

  hoveredRow: PageDealStatus | null = null;
  tooltipTop = 0;
  tooltipLeft = 0;

  constructor(
    private apiService: ApiService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private themeService: ThemeService,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: object,
  ) {}

  ngOnInit() {
    this.routeSub = this.route.url.subscribe(() => {
      const seg = this.route.snapshot.params['provider'] || this.route.snapshot.url[0]?.path || 'eneba';
      this.provider = seg.toLowerCase();
      this.syncData();
      this.cdr.markForCheck();
      if (isPlatformBrowser(this.platformId)) {
        setTimeout(() => {
          this.renderBestDiscountChart();
          this.cdr.markForCheck();
        }, 0);
      }
    });
  }

  get isLoading(): boolean {
    return this.apiService.isLoading() || !this.apiService.dashboardData();
  }

  get hasNoChartData(): boolean {
    const data = this.apiService.dashboardData();
    if (!data) return true;
    const history = data.history || [];
    const statuses = data.statuses || [];
    const hasHistoryDeal = history.some((h) => h.bestDeal || (h.totalListings && h.totalListings > 0));
    const hasStatusDeal = statuses.some((s) => s.bestDeal || s.bestEffectiveDeal || (s.rankedDeals && s.rankedDeals.length > 0));
    return !hasHistoryDeal && !hasStatusDeal;
  }

  @HostListener('window:resize')
  onResize() {
    this.triggerChartResize(this.chartInstance);
  }

  private triggerChartResize(chart?: echarts.ECharts): void {
    if (!chart || !isPlatformBrowser(this.platformId)) return;
    chart.resize();
    requestAnimationFrame(() => {
      chart.resize();
      setTimeout(() => chart.resize(), 60);
      setTimeout(() => chart.resize(), 250);
    });
  }

  showRowTooltip(event: MouseEvent, row: PageDealStatus): void {
    this.hoveredRow = row;
    this.updateTooltipCoords(event);
  }

  moveRowTooltip(event: MouseEvent): void {
    if (this.hoveredRow) {
      this.updateTooltipCoords(event);
    }
  }

  hideRowTooltip(): void {
    this.hoveredRow = null;
  }

  private updateTooltipCoords(event: MouseEvent): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const cardWidth = 360;
    const cardHeight = 220;
    const margin = 16;
    let x = event.clientX + 16;
    let y = event.clientY + 14;

    if (x + cardWidth > window.innerWidth - margin) {
      x = event.clientX - cardWidth - 16;
    }
    if (y + cardHeight > window.innerHeight - margin) {
      y = event.clientY - cardHeight - 14;
    }

    this.tooltipLeft = Math.max(margin, x);
    this.tooltipTop = Math.max(margin, y);
  }

  ngAfterViewInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.renderBestDiscountChart();
      this.triggerChartResize(this.chartInstance);
    }
  }

  ngOnDestroy() {
    this.routeSub?.unsubscribe();
    this.resizeObserver?.disconnect();
    this.chartInstance?.dispose();
  }

  ngDoCheck() {
    const data = this.apiService.dashboardData();
    if (data !== this.lastDataRef) {
      this.lastDataRef = data;
      this.syncData();
      this.cdr.markForCheck();
      if (isPlatformBrowser(this.platformId)) {
        setTimeout(() => {
          this.renderBestDiscountChart();
          this.cdr.markForCheck();
        }, 0);
      }
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

    const allStatuses = data.statuses || [];
    const statuses = allStatuses.filter((s) => {
      const cat = (s.category || '').toLowerCase();
      const prov = ((s as any).provider || '').toLowerCase();
      const url = (s.pageUrl || '').toLowerCase();
      const name = (s.targetName || s.name || '').toLowerCase();
      return (
        cat === this.provider ||
        prov === this.provider ||
        url.includes(this.provider) ||
        name.includes(`(${this.provider})`) ||
        name.includes(` ${this.provider}`) ||
        name.startsWith(`${this.provider} `)
      );
    });

    // Deduplicate by target ID, target name, or URL within this provider
    const deduplicatedStatuses: PageDealStatus[] = [];
    for (const st of statuses) {
      const stId = (st.scrapeTargetId || st.targetId || '').trim();
      const stName = (st.targetName || st.name || st.category || '').trim().toLowerCase();
      const stUrl = (st.pageUrl || '').trim().toLowerCase();

      const exIdx = deduplicatedStatuses.findIndex((ex) => {
        const exId = (ex.scrapeTargetId || ex.targetId || '').trim();
        if (stId && exId && stId === exId) return true;

        const exName = (ex.targetName || ex.name || ex.category || '').trim().toLowerCase();
        if (stName && exName && stName === exName) return true;

        const exUrl = (ex.pageUrl || '').trim().toLowerCase();
        if (stUrl && exUrl && (stUrl === exUrl || stUrl.split('?')[0] === exUrl.split('?')[0])) return true;

        return false;
      });

      if (exIdx === -1) {
        deduplicatedStatuses.push(st);
      } else {
        const exTime = new Date(deduplicatedStatuses[exIdx].scrapedAt || 0).getTime();
        const stTime = new Date(st.scrapedAt || 0).getTime();
        if (stTime >= exTime) {
          deduplicatedStatuses[exIdx] = {
            ...deduplicatedStatuses[exIdx],
            ...st,
            scrapeTargetId: st.scrapeTargetId || deduplicatedStatuses[exIdx].scrapeTargetId,
            targetId: st.targetId || deduplicatedStatuses[exIdx].targetId,
            targetName: st.targetName || st.name || deduplicatedStatuses[exIdx].targetName,
            name: st.name || st.targetName || deduplicatedStatuses[exIdx].name,
          };
        }
      }
    }

    this.sortedCategories = [...deduplicatedStatuses];

    // Gather categories
    this.availableCategories = Array.from(new Set(deduplicatedStatuses.map((s) => s.targetName || s.name || s.category)));

    // Gather all ranked deals across all matching categories
    const collected: (RankedDeal & { scrapedAt?: string })[] = [];
    for (const st of deduplicatedStatuses) {
      const deals = st.rankedDeals || st.topDeals || [];
      for (const d of deals) {
        collected.push({ ...d, scrapedAt: st.scrapedAt });
      }
      if (st.bestDeal) {
        const alreadyIn = deals.some((d) => d.url === st.bestDeal!.url || d.title === st.bestDeal!.title);
        if (!alreadyIn) {
          collected.push({ ...st.bestDeal, scrapedAt: st.scrapedAt });
        }
      }
    }

    // Sort by discountPct descending by default (highest discount first)
    collected.sort((a, b) => b.discountPct - a.discountPct);
    this.allDeals = collected;
    this.applyDealsFilter();
    this.cdr.markForCheck();

    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        this.renderBestDiscountChart();
        this.cdr.markForCheck();
      }, 0);
    }
  }

  categoriesCount(): number {
    return this.sortedCategories.length;
  }

  totalInStock(): number {
    return this.sortedCategories.reduce((acc, s) => acc + (s.inStockCount || 0), 0);
  }

  totalDiscounted(): number {
    return this.sortedCategories.reduce((acc, s) => acc + (s.discountedCount || 0), 0);
  }

  get topBestDeals(): (RankedDeal & { scrapedAt?: string })[] {
    const list: (RankedDeal & { scrapedAt?: string })[] = [];
    const seenUrls = new Set<string>();
    const seenTitles = new Set<string>();

    // 1. Gather all deals from allDeals with discountPct > 0
    for (const deal of this.allDeals) {
      if (!deal || deal.discountPct <= 0) continue;
      const urlKey = (deal.url || '').trim().toLowerCase();
      const titleKey = (deal.title || '').trim().toLowerCase();
      if (urlKey && seenUrls.has(urlKey)) continue;
      if (titleKey && seenTitles.has(titleKey)) continue;

      if (urlKey) seenUrls.add(urlKey);
      if (titleKey) seenTitles.add(titleKey);
      list.push(deal);
      if (list.length >= 3) break;
    }

    // 2. Check candidate bestDeal or bestEffectiveDeal from sortedCategories
    if (list.length < 3) {
      for (const st of this.sortedCategories) {
        const candidate = st.bestDeal || st.bestEffectiveDeal;
        if (!candidate || candidate.discountPct <= 0) continue;
        const urlKey = (candidate.url || '').trim().toLowerCase();
        const titleKey = (candidate.title || '').trim().toLowerCase();
        if (urlKey && seenUrls.has(urlKey)) continue;
        if (titleKey && seenTitles.has(titleKey)) continue;

        if (urlKey) seenUrls.add(urlKey);
        if (titleKey) seenTitles.add(titleKey);
        list.push({ ...candidate, scrapedAt: st.scrapedAt });
        if (list.length >= 3) break;
      }
    }

    // 3. Include any other active deals even if discountPct <= 0
    if (list.length < 3) {
      for (const deal of this.allDeals) {
        if (!deal) continue;
        const urlKey = (deal.url || '').trim().toLowerCase();
        const titleKey = (deal.title || '').trim().toLowerCase();
        if (urlKey && seenUrls.has(urlKey)) continue;
        if (titleKey && seenTitles.has(titleKey)) continue;

        if (urlKey) seenUrls.add(urlKey);
        if (titleKey) seenTitles.add(titleKey);
        list.push(deal);
        if (list.length >= 3) break;
      }
    }

    // 4. Check category listings if still fewer than 3
    if (list.length < 3) {
      for (const st of this.sortedCategories) {
        const candidates = [st.bestDeal, st.bestEffectiveDeal, ...(st.rankedDeals || []), ...(st.topDeals || [])];
        for (const candidate of candidates) {
          if (!candidate) continue;
          const urlKey = (candidate.url || '').trim().toLowerCase();
          const titleKey = (candidate.title || '').trim().toLowerCase();
          if (urlKey && seenUrls.has(urlKey)) continue;
          if (titleKey && seenTitles.has(titleKey)) continue;

          if (urlKey) seenUrls.add(urlKey);
          if (titleKey) seenTitles.add(titleKey);
          list.push({ ...candidate, scrapedAt: st.scrapedAt });
          if (list.length >= 3) break;
        }
        if (list.length >= 3) break;
      }
    }

    // 5. Fallback to configured target pages if no scrape results exist yet
    if (list.length < 3) {
      const pages = this.enebaPages;
      for (const p of pages) {
        const urlKey = (p.url || '').trim().toLowerCase();
        const titleKey = (p.name || p.categoryName || '').trim().toLowerCase();
        if (urlKey && seenUrls.has(urlKey)) continue;
        if (titleKey && seenTitles.has(titleKey)) continue;

        if (urlKey) seenUrls.add(urlKey);
        if (titleKey) seenTitles.add(titleKey);
        list.push({
          category: this.provider,
          title: p.name || p.categoryName || `${this.providerDisplayName} Gift Card`,
          url: p.url,
          region: 'UNITED STATES',
          sellingPrice: 0,
          originalPrice: 0,
          faceValue: 0,
          cashbackPct: 0,
          inStock: true,
          discountPct: 0,
          effectiveDiscountPct: 0,
          effectivePrice: 0,
          savingsAmount: 0,
        });
        if (list.length >= 3) break;
      }
    }

    list.sort((a, b) => (b.discountPct || 0) - (a.discountPct || 0));
    return list;
  }

  bestDealPct(): string {
    const top = this.topBestDeals;
    if (top.length > 0 && top[0].discountPct > 0) {
      return `${top[0].discountPct.toFixed(1)}%`;
    }
    const statuses = this.sortedCategories;
    const maxDisc = Math.max(...statuses.map((s) => s.maxDiscountPct || 0), 0);
    return maxDisc > 0 ? `${maxDisc.toFixed(1)}%` : '—';
  }

  bestDealTitle(): string {
    const top = this.topBestDeals;
    if (top.length > 0) {
      return top[0].title;
    }
    const statuses = this.sortedCategories;
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

  getSellerName(s: PageDealStatus): string {
    if (s.bestDeal?.lowestSellerName) return s.bestDeal.lowestSellerName;
    if (s.bestDealOffers && s.bestDealOffers.length > 0 && s.bestDealOffers[0].sellerName) {
      return s.bestDealOffers[0].sellerName;
    }
    return '';
  }

  getSavings(s: PageDealStatus): string | null {
    if (!s.bestDeal) return null;
    if (s.bestDeal.savingsAmount && s.bestDeal.savingsAmount > 0) {
      return s.bestDeal.savingsAmount.toFixed(2);
    }
    const orig = s.bestDeal.originalPrice || s.bestDeal.faceValue;
    if (orig && orig > s.bestDeal.sellingPrice) {
      return (orig - s.bestDeal.sellingPrice).toFixed(2);
    }
    return null;
  }

  getCategoryTooltip(s: PageDealStatus): string {
    const lines: string[] = [];
    lines.push(`🕒 Last Scraped: ${this.formatDate(s.scrapedAt)}`);
    if (s.bestDeal) {
      lines.push(`🏷️ Deal: ${s.bestDeal.title}`);
      const priceStr = `$${s.bestDeal.sellingPrice.toFixed(2)}`;
      const orig = s.bestDeal.originalPrice || s.bestDeal.faceValue;
      if (orig && orig > s.bestDeal.sellingPrice) {
        const diff = (orig - s.bestDeal.sellingPrice).toFixed(2);
        lines.push(`💰 Price: ${priceStr} (Was $${orig.toFixed(2)} • Save $${diff})`);
      } else {
        lines.push(`💰 Price: ${priceStr}`);
      }
      lines.push(`📉 Best Discount Seen: -${s.bestDeal.discountPct.toFixed(1)}%`);
      const seller = this.getSellerName(s);
      if (seller) {
        const rating = s.bestDeal.lowestSellerRating ? ` (${s.bestDeal.lowestSellerRating}★)` : '';
        lines.push(`🏪 Seller: ${seller}${rating}`);
      }
    }
    const count = s.bestDealOffers?.length || 0;
    if (count > 0) {
      lines.push(`👥 ${count} competing third-party seller offer${count > 1 ? 's' : ''}`);
      lines.push(`👉 Click row to view all competing seller offers`);
    } else {
      lines.push(`👥 No competing seller offers available`);
    }
    return lines.join('\n');
  }

  get schedulersList(): SchedulerState[] {
    const data = this.apiService.dashboardData();
    if (data?.schedulers && data.schedulers.length > 0) {
      return data.schedulers;
    }
    if (data?.scheduler) {
      return [data.scheduler];
    }
    return [];
  }

  get enebaPages(): ScrapePageConfig[] {
    const pages = this.apiService.dashboardData()?.pages || [];
    return pages.filter(
      (p) =>
        (p.provider || '').toLowerCase() === this.provider ||
        (p.category || '').toLowerCase() === this.provider ||
        p.url.toLowerCase().includes(this.provider) ||
        (p.name || '').toLowerCase().includes(this.provider) ||
        (p.categoryName || '').toLowerCase().includes(this.provider)
    );
  }

  openEnebaConfigModal() {
    const dialogRef = this.dialog.open(EnebaConfigDialogComponent, {
      data: {
        topDealsLimit: this.topDealsLimit,
        alertThresholdPct: this.alertThresholdPct,
        pages: this.enebaPages,
        schedulers: this.schedulersList,
      },
      width: '560px',
      maxWidth: '94vw',
    });

    dialogRef.afterClosed().subscribe((res) => {
      if (res) {
        this.topDealsLimit = res.topDealsLimit;
        this.alertThresholdPct = res.alertThresholdPct;
        this.saveEnebaConfig();

        if (res.pageSchedules) {
          for (const [pageId, schedId] of Object.entries(res.pageSchedules)) {
            const page = this.enebaPages.find((p) => p.id === pageId);
            if (page && (page.scheduleId || 'default') !== schedId) {
              this.apiService.assignPageSchedule(pageId, schedId as string).subscribe();
            }
          }
        }
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
    this.apiService.triggerScrape({ provider: this.provider }).subscribe(() => {
      this.snackBar.open(`Scrape triggered for ${this.providerDisplayName} pages!`, 'OK', { duration: 3000 });
    });
  }

  openOffers(status: PageDealStatus) {
    if (!status.bestDealOffers?.length && !status.bestDeal) {
      this.snackBar.open(`No competing seller offers for ${status.category} yet.`, 'OK', { duration: 2500 });
      return;
    }
    this.dialog.open(SellerOffersDialogComponent, {
      data: {
        title: status.bestDeal?.title || status.bestEffectiveDeal?.title || `${status.category} Gift Cards`,
        offers: status.bestDealOffers || [],
      },
      width: '720px',
    });
  }

  applyDealsFilter() {
    const q = this.searchQuery.trim().toLowerCase();
    const cat = this.selectedCategory;

    const matched = this.allDeals.filter((deal) => {
      const dealCat = deal.targetName || deal.category;
      const matchCat = cat === 'all' || dealCat === cat || deal.category === cat;
      const matchQ =
        !q ||
        deal.title.toLowerCase().includes(q) ||
        (deal.region && deal.region.toLowerCase().includes(q)) ||
        (dealCat && dealCat.toLowerCase().includes(q)) ||
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
        case 'category': return compare(a.targetName || a.name || a.category, b.targetName || b.name || b.category, isAsc);
        case 'inStockCount': return compare(a.inStockCount, b.inStockCount, isAsc);
        case 'averageDiscountPctAllInStock': return compare(a.averageDiscountPctAllInStock, b.averageDiscountPctAllInStock, isAsc);
        case 'latestDiscount':
        case 'bestDiscountSeen':
        case 'bestEffectiveDeal': {
          const aPct = a.bestDeal?.discountPct ?? -1;
          const bPct = b.bestDeal?.discountPct ?? -1;
          return compare(aPct, bPct, isAsc);
        }
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

    return maxPct > 0 ? `${maxPct.toFixed(1)}%` : '—';
  }

  private renderBestDiscountChart(): void {
    if (!this.bestDiscountChartContainerRef?.nativeElement) return;

    const data = this.apiService.dashboardData();
    const history = data?.history || [];
    const statuses = this.sortedCategories;

    let items = history.filter((h) => {
      const cat = (h.bestDeal?.category || (h as any).provider || '').toLowerCase();
      const hasListings = h.totalListings && h.totalListings > 0;
      return (h.bestDeal || hasListings) && (!cat || cat === this.provider);
    });

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

    const container = this.bestDiscountChartContainerRef.nativeElement;
    if (!this.chartInstance) {
      this.chartInstance = echarts.init(container);
      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver((entries) => {
          for (const entry of entries) {
            if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
              this.chartInstance?.resize();
              this.cdr.markForCheck();
            }
          }
        });
        this.resizeObserver.observe(container);
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
    this.triggerChartResize(this.chartInstance);
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
