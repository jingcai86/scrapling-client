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
import {
  type PageDealStatus,
  type RankedDeal,
  type SellerOffer,
  type ScrapeHistoryItem,
  type ScrapePageConfig,
  type SchedulerState,
  type TargetFaceValueAnalytics,
  type FaceValueStatItem,
  CANONICAL_TARGET_URLS,
  CANONICAL_CATEGORY_URLS,
} from '../../core/models/dashboard.model';

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
        <!-- Category / Page Summary Table -->
        <mat-card class="main-card half-card" appearance="outlined">
          <mat-card-header class="table-header">
            <div class="table-header-titles">
              <mat-card-title>{{ providerDisplayName }} Pages — Scrape Run Details</mat-card-title>
              <mat-card-subtitle>
                Scraping run telemetry, execution status, and denomination analytics per task. Click any row to expand details.
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
              <span class="loading-label">Loading page statuses &amp; deal analytics...</span>
            </div>

            <div class="table-wrapper" [class.table-loading-dimmed]="isLoading">
              <table
                mat-table
                [dataSource]="sortedCategories"
                multiTemplateDataRows
                matSort
                (matSortChange)="sortCategories($event)"
                class="data-table category-table"
              >
                <!-- Page Column (with expand chevron) -->
                <ng-container matColumnDef="page">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header class="col-page">Page</th>
                  <td mat-cell *matCellDef="let s" class="col-page">
                    <div class="page-title-row">
                      <mat-icon class="expand-chevron" [class.rotated]="isRowExpanded(s)">
                        chevron_right
                      </mat-icon>
                      <span class="cat-title">{{ s.targetName || s.name || s.category }}</span>
                    </div>
                  </td>
                </ng-container>

                <!-- Average Discount Column -->
                <ng-container matColumnDef="averageDiscount">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header class="col-avg">Avg Discount</th>
                  <td mat-cell *matCellDef="let s" class="col-avg">
                    <span class="badge badge-discount" *ngIf="getAvgDiscountDisplay(s).hasDiscount" [matTooltip]="getAvgDiscountDisplay(s).tooltip || ''">
                      {{ getAvgDiscountDisplay(s).text }}
                    </span>
                    <span class="badge badge-muted" *ngIf="!getAvgDiscountDisplay(s).hasDiscount && !getAvgDiscountDisplay(s).isMuted" [matTooltip]="getAvgDiscountDisplay(s).tooltip || ''">
                      {{ getAvgDiscountDisplay(s).text }}
                    </span>
                    <span class="muted" *ngIf="getAvgDiscountDisplay(s).isMuted">—</span>
                  </td>
                </ng-container>

                <!-- Latest Deal Column -->
                <ng-container matColumnDef="latestDiscount">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header class="col-latest-deal">Latest Deal</th>
                  <td mat-cell *matCellDef="let s" class="col-latest-deal">
                    <a
                      *ngIf="getLatestDealDisplay(s).hasDeal && getLatestDealDisplay(s).url"
                      [href]="getLatestDealDisplay(s).url"
                      target="_blank"
                      rel="noopener"
                      class="deal-cell-link"
                      [title]="getLatestDealDisplay(s).title"
                      (click)="$event.stopPropagation()"
                    >
                      <span class="badge badge-discount-peak" *ngIf="getLatestDealDisplay(s).discountPct > 0">
                        -{{ getLatestDealDisplay(s).discountPct.toFixed(1) }}%
                      </span>
                      <span class="badge badge-muted" *ngIf="getLatestDealDisplay(s).discountPct <= 0">
                        0.0%
                      </span>
                      <strong class="deal-price-text" *ngIf="getLatestDealDisplay(s).price">
                        (\${{ getLatestDealDisplay(s).price }})
                      </strong>
                    </a>
                    <span
                      *ngIf="getLatestDealDisplay(s).hasDeal && !getLatestDealDisplay(s).url"
                      class="deal-cell-static"
                      [title]="getLatestDealDisplay(s).title"
                    >
                      <span class="badge badge-discount-peak" *ngIf="getLatestDealDisplay(s).discountPct > 0">
                        -{{ getLatestDealDisplay(s).discountPct.toFixed(1) }}%
                      </span>
                      <span class="badge badge-muted" *ngIf="getLatestDealDisplay(s).discountPct <= 0">
                        0.0%
                      </span>
                      <strong class="deal-price-text" *ngIf="getLatestDealDisplay(s).price">
                        (\${{ getLatestDealDisplay(s).price }})
                      </strong>
                    </span>
                    <span class="muted" *ngIf="!getLatestDealDisplay(s).hasDeal">—</span>
                  </td>
                </ng-container>

                <!-- Best Face Value Column (Renamed to Best Value) -->
                <ng-container matColumnDef="bestFace">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header class="col-best-face">Best Value</th>
                  <td mat-cell *matCellDef="let s" class="col-best-face">
                    <span class="badge badge-face-pill" *ngIf="getPeakFace(s).faceValue !== '—'" matTooltip="Highest peak discount denomination observed for this page">
                      \${{ getPeakFace(s).faceValue }} <small>(-{{ getPeakFace(s).peakPct }}%)</small>
                    </span>
                    <span class="muted" *ngIf="getPeakFace(s).faceValue === '—'">—</span>
                  </td>
                </ng-container>

                <!-- Last Scraped Column -->
                <ng-container matColumnDef="lastScraped">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header class="col-last-scraped">Scraped</th>
                  <td mat-cell *matCellDef="let s" class="col-last-scraped">
                    <div class="scraped-time-cell" [matTooltip]="formatScrapedAt(s.scrapedAt)">
                      <span class="scraped-relative">{{ formatTimeAgo(s.scrapedAt) }}</span>
                    </div>
                  </td>
                </ng-container>

                <!-- Expandable Detail Row (Colspan = 5) -->
                <ng-container matColumnDef="expandedDetail">
                  <td mat-cell *matCellDef="let s" [attr.colspan]="categoryColumns.length" class="expanded-detail-td">
                    <div class="expanded-detail-wrapper" *ngIf="isRowExpanded(s)">
                      <!-- 1. Minimal Deal Detail Analytics Grid -->
                      <div class="deal-analytics-grid">
                        <!-- Metric 1: Average % Discount -->
                        <div class="analytics-card">
                          <div class="analytics-card-header">
                            <mat-icon class="card-icon">percent</mat-icon>
                            <span class="card-label">Average Discount</span>
                          </div>
                          <div class="analytics-card-val" [class.highlight-pct]="getAvgDiscountPct(s) > 0">
                            {{ getAvgDiscountDisplay(s).text }}
                          </div>
                          <div class="analytics-card-sub">Across all in-stock listings</div>
                        </div>

                        <!-- Metric 2: Latest Deal % Discount & Actual Savings -->
                        <div class="analytics-card">
                          <div class="analytics-card-header">
                            <mat-icon class="card-icon">local_fire_department</mat-icon>
                            <span class="card-label">Latest Best Deal</span>
                          </div>
                          <div class="analytics-card-val highlight-emerald" *ngIf="getLatestDealDisplay(s).hasDeal && getLatestDealDisplay(s).discountPct > 0">
                            -{{ getLatestDealDisplay(s).discountPct.toFixed(1) }}%
                            <small class="savings-chip" *ngIf="getActualDiscountSavings(s) !== '0.00'">Save \${{ getActualDiscountSavings(s) }}</small>
                          </div>
                          <div class="analytics-card-val" *ngIf="getLatestDealDisplay(s).hasDeal && getLatestDealDisplay(s).discountPct <= 0">
                            0.0% <small class="savings-chip" *ngIf="getLatestDealDisplay(s).price">(\${{ getLatestDealDisplay(s).price }})</small>
                          </div>
                          <div class="analytics-card-val muted" *ngIf="!getLatestDealDisplay(s).hasDeal">
                            No active discount
                          </div>
                          <div class="analytics-card-sub">{{ getPriceOnFaceSummary(s) }}</div>
                        </div>

                        <!-- Metric 3: Which Face Value Has Discount Most of Time -->
                        <div class="analytics-card">
                          <div class="analytics-card-header">
                            <mat-icon class="card-icon">repeat</mat-icon>
                            <span class="card-label">Most Frequent Discount</span>
                          </div>
                          <div class="analytics-card-val" *ngIf="getMostFrequentFace(s).faceValue !== '—'">
                            <a
                              *ngIf="getMostFrequentFace(s).url"
                              [href]="getMostFrequentFace(s).url"
                              target="_blank"
                              rel="noopener"
                              class="analytics-card-link"
                              [title]="getMostFrequentFace(s).title"
                              (click)="$event.stopPropagation()"
                            >
                              <span class="card-link-title">{{ getMostFrequentFace(s).title }}</span>
                              <mat-icon class="link-arrow">north_east</mat-icon>
                            </a>
                            <span *ngIf="!getMostFrequentFace(s).url" class="card-link-title" [title]="getMostFrequentFace(s).title">
                              {{ getMostFrequentFace(s).title }}
                            </span>
                          </div>
                          <div class="analytics-card-val muted" *ngIf="getMostFrequentFace(s).faceValue === '—'">
                            —
                          </div>
                          <div class="analytics-card-sub">Discounted {{ getMostFrequentFace(s).timesText }} (avg -{{ getMostFrequentFace(s).avgPct }}%)</div>
                        </div>

                        <!-- Metric 4: Which Face Value Has the Most Discount -->
                        <div class="analytics-card">
                          <div class="analytics-card-header">
                            <mat-icon class="card-icon">trending_down</mat-icon>
                            <span class="card-label">Highest Peak Discount</span>
                          </div>
                          <div class="analytics-card-val highlight-emerald" *ngIf="getPeakFace(s).faceValue !== '—'">
                            <a
                              *ngIf="getPeakFace(s).url"
                              [href]="getPeakFace(s).url"
                              target="_blank"
                              rel="noopener"
                              class="analytics-card-link highlight-emerald"
                              [title]="getPeakFace(s).title"
                              (click)="$event.stopPropagation()"
                            >
                              <span class="card-link-title">{{ getPeakFace(s).title }} (-{{ getPeakFace(s).peakPct }}%)</span>
                              <mat-icon class="link-arrow">north_east</mat-icon>
                            </a>
                            <span *ngIf="!getPeakFace(s).url" class="card-link-title" [title]="getPeakFace(s).title">
                              {{ getPeakFace(s).title }} (-{{ getPeakFace(s).peakPct }}%)
                            </span>
                          </div>
                          <div class="analytics-card-val muted" *ngIf="getPeakFace(s).faceValue === '—'">
                            —
                          </div>
                          <div class="analytics-card-sub">Lowest price \${{ getPeakFace(s).minPrice }} (Save \${{ getPeakFace(s).savings }})</div>
                        </div>
                      </div>

                      <!-- 2. Face Value / Denominations Breakdown Strip -->
                      <div class="face-values-strip" *ngIf="getFaceValuesList(s).length > 0">
                        <div class="strip-header">
                          <mat-icon class="strip-icon">view_list</mat-icon>
                          <span class="strip-title">Monitored Denominations &amp; Current Pricing:</span>
                        </div>
                        <div class="face-pills-row">
                          <ng-container *ngFor="let face of getFaceValuesList(s)">
                            <a
                              *ngIf="face.url"
                              [href]="face.url"
                              target="_blank"
                              rel="noopener"
                              class="face-pill face-pill-link"
                              [class.has-discount]="face.discountPct > 0"
                              [title]="face.title || ('\$' + face.faceValue + ' Face Card')"
                              (click)="$event.stopPropagation()"
                            >
                              <strong class="face-val-num">\${{ face.faceValue }}</strong>
                              <span class="face-discount-tag" *ngIf="face.discountPct > 0">-{{ face.discountPct.toFixed(1) }}%</span>
                              <span class="face-price-num">\${{ face.sellingPrice.toFixed(2) }}</span>
                              <span class="face-save-tag" *ngIf="face.savingsAmount > 0">(save \${{ face.savingsAmount.toFixed(2) }})</span>
                              <mat-icon class="pill-arrow">north_east</mat-icon>
                            </a>
                            <div
                              *ngIf="!face.url"
                              class="face-pill"
                              [class.has-discount]="face.discountPct > 0"
                              [title]="face.title || ('\$' + face.faceValue + ' Face Card')"
                            >
                              <strong class="face-val-num">\${{ face.faceValue }}</strong>
                              <span class="face-discount-tag" *ngIf="face.discountPct > 0">-{{ face.discountPct.toFixed(1) }}%</span>
                              <span class="face-price-num">\${{ face.sellingPrice.toFixed(2) }}</span>
                              <span class="face-save-tag" *ngIf="face.savingsAmount > 0">(save \${{ face.savingsAmount.toFixed(2) }})</span>
                            </div>
                          </ng-container>
                        </div>
                      </div>

                      <!-- 3. Target Metadata Strip -->
                      <div class="target-config-strip">
                        <div class="config-item">
                          <mat-icon class="meta-icon">schedule</mat-icon>
                          <span class="config-label">Last Scraped:</span>
                          <strong class="config-val">{{ formatScrapedAt(s.scrapedAt) }} ({{ formatTimeAgo(s.scrapedAt) }})</strong>
                        </div>
                        <div class="config-divider"></div>
                        <div class="config-item">
                          <mat-icon class="meta-icon">history</mat-icon>
                          <span class="config-label">Scrapes:</span>
                          <strong class="config-val">{{ s.scrapeCount || 1 }} runs</strong>
                        </div>
                        <div class="config-divider"></div>
                        <div class="config-item">
                          <mat-icon class="meta-icon">inventory_2</mat-icon>
                          <span class="config-label">In Stock:</span>
                          <strong class="config-val">{{ s.inStockCount }} / {{ s.totalListings }} listings</strong>
                        </div>
                        <div class="config-divider"></div>
                        <div class="config-item target-url-item">
                          <a [href]="getStorePageUrl(s)" target="_blank" rel="noopener noreferrer" class="config-url-link" (click)="$event.stopPropagation()">
                            <span class="url-text">Open Store Page ↗</span>
                          </a>
                        </div>
                      </div>
                    </div>
                  </td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="categoryColumns"></tr>
                <tr
                  mat-row
                  *matRowDef="let row; columns: categoryColumns;"
                  class="category-table-row clickable-row"
                  [class.expanded-parent-row]="isRowExpanded(row)"
                  (click)="toggleRowExpanded(row)"
                ></tr>
                <tr
                  mat-row
                  *matRowDef="let row; columns: ['expandedDetail'];"
                  class="detail-expand-row"
                  [class.detail-expand-collapsed]="!isRowExpanded(row)"
                ></tr>
              </table>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Best Discount in History Chart -->
        <mat-card class="main-card half-card" appearance="outlined">
          <mat-card-header class="table-header">
            <mat-card-title class="chart-header-title">{{ providerDisplayName }} Best Discount in History</mat-card-title>
            <mat-card-subtitle>
              Historical #1 highest {{ providerDisplayName }} discount across scrape runs. Hover point for seller, cost, and face value.
            </mat-card-subtitle>
            <div class="peak-badge-box" *ngIf="!isLoading">
              <span class="peak-label">{{ providerDisplayName }} Peak:</span>
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
      max-width: 100%;
    }
    .table-wrapper {
      width: 100% !important;
      max-width: 100% !important;
      overflow-x: auto !important;
      overflow-y: hidden;
      display: block;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: thin;
      scrollbar-color: rgba(99, 102, 241, 0.45) rgba(255, 255, 255, 0.04);
    }
    .table-wrapper::-webkit-scrollbar {
      height: 7px;
    }
    .table-wrapper::-webkit-scrollbar-track {
      background: rgba(255, 255, 255, 0.04);
      border-radius: 4px;
    }
    .table-wrapper::-webkit-scrollbar-thumb {
      background: rgba(99, 102, 241, 0.4);
      border-radius: 4px;
    }
    .table-wrapper::-webkit-scrollbar-thumb:hover {
      background: rgba(99, 102, 241, 0.65);
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
    .clickable-row {
      cursor: pointer;
      transition: background-color 0.15s ease;

      &:hover {
        background-color: var(--mat-sys-surface-container-high) !important;
      }
    }
    .deals-table {
      min-width: 900px !important;
    }
    .col-page {
      width: 30% !important;
      min-width: 125px !important;
      padding-left: 0.85rem !important;
      white-space: nowrap !important;
    }
    .col-avg {
      width: 18% !important;
      min-width: 75px !important;
      white-space: nowrap !important;
      text-align: center;
    }
    .col-latest-deal {
      width: 25% !important;
      min-width: 110px !important;
      white-space: nowrap !important;
      text-align: left;
    }
    .col-best-face {
      width: 15% !important;
      min-width: 85px !important;
      white-space: nowrap !important;
      text-align: center;
    }
    .col-last-scraped {
      width: 12% !important;
      min-width: 75px !important;
      white-space: nowrap !important;
      text-align: right;
      padding-right: 0.85rem !important;
    }
    .badge-face-pill {
      background: rgba(99, 102, 241, 0.12);
      color: var(--mat-sys-primary);
      border: 1px solid rgba(99, 102, 241, 0.25);
      font-weight: 600;
      font-size: 0.74rem;
      padding: 0.12rem 0.45rem;
      border-radius: 5px;
      display: inline-block;
      white-space: nowrap;

      small {
        color: #10b981;
        font-weight: 700;
      }
    }
    .scraped-time-cell {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.8rem;
      color: var(--mat-sys-on-surface-variant);
    }
    .scraped-relative {
      font-weight: 500;
    }
    .badge-runs {
      background: rgba(99, 102, 241, 0.12);
      color: var(--mat-sys-primary);
      border: 1px solid rgba(99, 102, 241, 0.25);
      font-weight: 600;
      font-size: 0.76rem;
      padding: 0.15rem 0.5rem;
      border-radius: 6px;
      display: inline-block;
      white-space: nowrap;
    }
    .badge-status-success {
      background: rgba(16, 185, 129, 0.12);
      color: #10b981;
      border: 1px solid rgba(16, 185, 129, 0.28);
      font-weight: 600;
      font-size: 0.76rem;
      padding: 0.15rem 0.5rem;
      border-radius: 6px;
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      white-space: nowrap;
    }
    .badge-status-warning {
      background: rgba(245, 158, 11, 0.12);
      color: #f59e0b;
      border: 1px solid rgba(245, 158, 11, 0.28);
      font-weight: 600;
      font-size: 0.76rem;
      padding: 0.15rem 0.5rem;
      border-radius: 6px;
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      white-space: nowrap;
    }
    .status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      display: inline-block;
    }
    .green-dot {
      background: #10b981;
      box-shadow: 0 0 5px rgba(16, 185, 129, 0.6);
    }
    .amber-dot {
      background: #f59e0b;
      box-shadow: 0 0 5px rgba(245, 158, 11, 0.6);
    }
    .page-title-row {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-weight: 600;
      color: var(--mat-sys-on-surface);
      cursor: pointer;
      user-select: none;
    }
    .expand-chevron {
      font-size: 19px !important;
      width: 19px !important;
      height: 19px !important;
      line-height: 19px !important;
      color: var(--mat-sys-outline);
      transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), color 0.15s ease;
      flex-shrink: 0;
    }
    .expand-chevron.rotated {
      transform: rotate(90deg);
      color: var(--mat-sys-primary);
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
    .deal-cell-static {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      color: var(--mat-sys-on-surface);
      white-space: nowrap !important;
      line-height: 1.3;
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
    .expanded-parent-row {
      background-color: var(--mat-sys-surface-container-high) !important;
    }
    .expanded-parent-row td {
      border-bottom-color: transparent !important;
    }
    .detail-expand-row {
      height: 0 !important;
      min-height: 0 !important;
    }
    .detail-expand-row.detail-expand-collapsed {
      display: none !important;
    }
    .expanded-detail-td {
      padding: 0 !important;
      border-bottom: 1px solid var(--mat-sys-outline-variant, rgba(255, 255, 255, 0.08)) !important;
    }
    .expanded-detail-wrapper {
      padding: 0.85rem 1rem 1rem;
      background: var(--mat-sys-surface-container);
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      animation: expandFadeIn 0.18s ease-out;
    }
    @keyframes expandFadeIn {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .expand-meta-strip {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.75rem 1.25rem;
      font-size: 0.82rem;
      color: var(--mat-sys-on-surface-variant);
      padding-bottom: 0.5rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }
    .expand-meta-item {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
    }
    .meta-icon {
      font-size: 16px !important;
      width: 16px !important;
      height: 16px !important;
      line-height: 16px !important;
      color: var(--mat-sys-primary);
    }
    .meta-label {
      color: var(--mat-sys-outline);
    }
    .meta-val {
      color: var(--mat-sys-on-surface);
      font-weight: 600;
    }
    .meta-page-link {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      color: var(--mat-sys-primary);
      text-decoration: none;
      font-weight: 600;
      margin-left: auto;
      font-size: 0.8rem;

      &:hover {
        text-decoration: underline;
      }
    }
    .deal-analytics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(135px, 1fr));
      gap: 0.65rem;
    }
    .analytics-card {
      background: var(--mat-sys-surface-container-high);
      border: 1px solid var(--mat-sys-outline-variant, rgba(255, 255, 255, 0.08));
      border-radius: 8px;
      padding: 0.55rem 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }
    .analytics-card-header {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.72rem;
      color: var(--mat-sys-outline);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .card-icon {
      font-size: 15px !important;
      width: 15px !important;
      height: 15px !important;
      line-height: 15px !important;
      color: var(--mat-sys-primary);
    }
    .analytics-card-val {
      font-size: 0.88rem;
      font-weight: 700;
      color: var(--mat-sys-on-surface);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .analytics-card-val.highlight-pct {
      color: #10b981;
    }
    .analytics-card-val.highlight-emerald {
      color: #10b981;
    }
    .analytics-card-link {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      color: var(--mat-sys-primary);
      text-decoration: none;
      max-width: 100%;
      white-space: nowrap;
      line-height: 1.3;
      font-weight: 700;
      transition: all 0.15s ease;

      &:hover {
        text-decoration: underline;

        .card-link-title {
          text-decoration: underline;
        }
      }

      &.highlight-emerald {
        color: #10b981;
      }

      .card-link-title {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: calc(100% - 16px);
      }

      .link-arrow {
        font-size: 13px !important;
        width: 13px !important;
        height: 13px !important;
        line-height: 13px !important;
        flex-shrink: 0;
      }
    }
    .savings-chip {
      font-size: 0.7rem;
      background: rgba(16, 185, 129, 0.12);
      color: #10b981;
      padding: 0.08rem 0.35rem;
      border-radius: 4px;
      margin-left: 0.25rem;
      font-weight: 600;
    }
    .analytics-card-sub {
      font-size: 0.72rem;
      color: var(--mat-sys-on-surface-variant);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .face-values-strip {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      background: rgba(255, 255, 255, 0.015);
      border: 1px solid var(--mat-sys-outline-variant, rgba(255, 255, 255, 0.06));
      border-radius: 8px;
      padding: 0.5rem 0.75rem;
    }
    .strip-header {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.74rem;
      font-weight: 600;
      color: var(--mat-sys-on-surface-variant);
    }
    .strip-icon {
      font-size: 15px !important;
      width: 15px !important;
      height: 15px !important;
      line-height: 15px !important;
      color: var(--mat-sys-primary);
    }
    .face-pills-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }
    .face-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.74rem;
      padding: 0.2rem 0.5rem;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.07);
      color: var(--mat-sys-on-surface-variant);

      &.has-discount {
        border-color: rgba(16, 185, 129, 0.3);
        background: rgba(16, 185, 129, 0.06);

        .face-val-num {
          color: var(--mat-sys-on-surface);
        }
      }

      &.face-pill-link {
        text-decoration: none;
        cursor: pointer;
        transition: all 0.15s ease;

        &:hover {
          border-color: var(--mat-sys-primary) !important;
          background: rgba(99, 102, 241, 0.12) !important;
        }

        .pill-arrow {
          font-size: 11px !important;
          width: 11px !important;
          height: 11px !important;
          line-height: 11px !important;
          color: var(--mat-sys-primary);
          opacity: 0.75;
          margin-left: 0.15rem;
        }
      }
    }
    .face-val-num {
      font-weight: 700;
    }
    .face-discount-tag {
      background: rgba(16, 185, 129, 0.16);
      color: #10b981;
      font-weight: 700;
      font-size: 0.7rem;
      padding: 0.05rem 0.3rem;
      border-radius: 3px;
    }
    .face-price-num {
      font-weight: 600;
      color: var(--mat-sys-on-surface);
    }
    .face-save-tag {
      color: #10b981;
      font-size: 0.68rem;
    }
    .target-config-strip {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.5rem 0.85rem;
      padding: 0.45rem 0.75rem;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 6px;
      font-size: 0.78rem;
    }
    .config-item {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
    }
    .config-label {
      color: var(--mat-sys-outline);
    }
    .config-val {
      color: var(--mat-sys-on-surface);
    }
    .config-divider {
      width: 1px;
      height: 14px;
      background: rgba(255, 255, 255, 0.1);
    }
    .config-url-link {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      color: var(--mat-sys-primary);
      text-decoration: none;
      font-weight: 500;
      font-size: 0.78rem;

      &:hover {
        text-decoration: underline;
      }
    }
    .half-card {
      display: flex;
      flex-direction: column;
      min-width: 0 !important;
      overflow: hidden;
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
    return this.getProviderDisplayName(this.provider);
  }

  getProviderDisplayName(provider?: string | null): string {
    if (!provider) return 'Provider';
    const lower = provider.toLowerCase().trim();
    if (lower === 'g2a') return 'G2A';
    if (lower === 'eneba') return 'Eneba';
    return provider.charAt(0).toUpperCase() + provider.slice(1);
  }

  get activeTargetNames(): string[] {
    return this.sortedCategories.map((s) => s.targetName || s.name || s.category);
  }

  categoryColumns: string[] = [
    'page',
    'averageDiscount',
    'latestDiscount',
    'bestFace',
    'lastScraped',
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

  expandedRowKeys = new Set<string>();

  isRowExpanded(row: PageDealStatus): boolean {
    return this.expandedRowKeys.has(this.getRowKey(row));
  }

  toggleRowExpanded(row: PageDealStatus): void {
    const key = this.getRowKey(row);
    if (this.expandedRowKeys.has(key)) {
      this.expandedRowKeys.delete(key);
    } else {
      this.expandedRowKeys.add(key);
    }
  }

  private getRowKey(s: PageDealStatus): string {
    return s.targetId || s.scrapeTargetId || s.targetName || s.name || s.category;
  }

  formatScrapedAt(dateStr: string): string {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString([], {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  formatTimeAgo(dateStr?: string): string {
    if (!dateStr) return 'Never';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const diffMs = Date.now() - d.getTime();
    if (diffMs < 0) return 'Just now';
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }

  getAvgDiscountPct(s: PageDealStatus): number {
    if (s.averageDiscountPctAllInStock && s.averageDiscountPctAllInStock > 0) {
      return s.averageDiscountPctAllInStock;
    }
    if (s.faceAnalytics?.mostFrequentFace?.avgDiscountPct && s.faceAnalytics.mostFrequentFace.avgDiscountPct > 0) {
      return s.faceAnalytics.mostFrequentFace.avgDiscountPct;
    }
    if (s.bestDeal && s.bestDeal.discountPct > 0) {
      return s.bestDeal.discountPct;
    }
    if (s.faceAnalytics?.peakDiscountFace?.maxDiscountPct && s.faceAnalytics.peakDiscountFace.maxDiscountPct > 0) {
      return s.faceAnalytics.peakDiscountFace.maxDiscountPct;
    }
    return 0;
  }

  getAvgDiscountDisplay(s: PageDealStatus): { text: string; hasDiscount: boolean; isMuted: boolean; tooltip?: string } {
    const pct = this.getAvgDiscountPct(s);
    if (pct > 0) {
      return {
        text: `-${pct.toFixed(1)}%`,
        hasDiscount: true,
        isMuted: false,
        tooltip: s.averageDiscountPctAllInStock > 0
          ? `Average discount across all in-stock listings: ${s.averageDiscountPctAllInStock.toFixed(1)}%`
          : `Observed discount on monitored face values: ${pct.toFixed(1)}%`,
      };
    }
    if (s.totalListings > 0 || (s.rankedDeals && s.rankedDeals.length > 0)) {
      return {
        text: '0.0%',
        hasDiscount: false,
        isMuted: false,
        tooltip: 'Listings active at standard retail price (0% discount)',
      };
    }
    return { text: '—', hasDiscount: false, isMuted: true };
  }

  getLatestDealPct(s: PageDealStatus): number {
    if (s.bestDeal && s.bestDeal.discountPct > 0) {
      return s.bestDeal.discountPct;
    }
    if (s.bestEffectiveDeal && s.bestEffectiveDeal.discountPct > 0) {
      return s.bestEffectiveDeal.discountPct;
    }
    if (s.rankedDeals && s.rankedDeals.length > 0 && s.rankedDeals[0].discountPct > 0) {
      return s.rankedDeals[0].discountPct;
    }
    if (s.faceAnalytics?.peakDiscountFace && s.faceAnalytics.peakDiscountFace.maxDiscountPct > 0) {
      return s.faceAnalytics.peakDiscountFace.maxDiscountPct;
    }
    return 0;
  }

  getLatestDealDisplay(s: PageDealStatus): {
    hasDeal: boolean;
    discountPct: number;
    price: string | null;
    url: string | null;
    title: string;
  } {
    if (s.bestDeal && (s.bestDeal.discountPct > 0 || (s.bestDeal.sellingPrice && s.bestDeal.sellingPrice > 0))) {
      return {
        hasDeal: true,
        discountPct: s.bestDeal.discountPct || 0,
        price: s.bestDeal.sellingPrice ? s.bestDeal.sellingPrice.toFixed(2) : null,
        url: s.bestDeal.url || null,
        title: s.bestDeal.title || 'Latest Deal',
      };
    }
    if (s.bestEffectiveDeal && (s.bestEffectiveDeal.discountPct > 0 || (s.bestEffectiveDeal.sellingPrice && s.bestEffectiveDeal.sellingPrice > 0))) {
      return {
        hasDeal: true,
        discountPct: s.bestEffectiveDeal.discountPct || 0,
        price: s.bestEffectiveDeal.sellingPrice ? s.bestEffectiveDeal.sellingPrice.toFixed(2) : null,
        url: s.bestEffectiveDeal.url || null,
        title: s.bestEffectiveDeal.title || 'Latest Deal',
      };
    }
    if (s.rankedDeals && s.rankedDeals.length > 0) {
      const d = s.rankedDeals[0];
      return {
        hasDeal: true,
        discountPct: d.discountPct || 0,
        price: d.sellingPrice ? d.sellingPrice.toFixed(2) : null,
        url: d.url || null,
        title: d.title || 'Latest Deal',
      };
    }
    if (s.faceAnalytics?.peakDiscountFace && s.faceAnalytics.peakDiscountFace.maxDiscountPct > 0) {
      const pf = s.faceAnalytics.peakDiscountFace;
      return {
        hasDeal: true,
        discountPct: pf.maxDiscountPct,
        price: pf.minPrice ? pf.minPrice.toFixed(2) : null,
        url: s.pageUrl || null,
        title: `Peak discount: $${pf.faceValue} face at $${pf.minPrice.toFixed(2)}`,
      };
    }
    return {
      hasDeal: false,
      discountPct: 0,
      price: null,
      url: null,
      title: '',
    };
  }

  getActualDiscountSavings(s: PageDealStatus): string {
    if (s.bestDeal?.savingsAmount && s.bestDeal.savingsAmount > 0) {
      return s.bestDeal.savingsAmount.toFixed(2);
    }
    const orig = s.bestDeal?.originalPrice || s.bestDeal?.faceValue;
    if (orig && s.bestDeal?.sellingPrice && orig > s.bestDeal.sellingPrice) {
      return (orig - s.bestDeal.sellingPrice).toFixed(2);
    }
    if (s.faceAnalytics?.peakDiscountFace?.savingsAmount && s.faceAnalytics.peakDiscountFace.savingsAmount > 0) {
      return s.faceAnalytics.peakDiscountFace.savingsAmount.toFixed(2);
    }
    if (s.faceAnalytics?.peakDiscountFace?.faceValue && s.faceAnalytics?.peakDiscountFace?.minPrice) {
      const diff = s.faceAnalytics.peakDiscountFace.faceValue - s.faceAnalytics.peakDiscountFace.minPrice;
      if (diff > 0) return diff.toFixed(2);
    }
    return '0.00';
  }

  getPriceOnFaceSummary(s: PageDealStatus): string {
    if (s.bestDeal && s.bestDeal.sellingPrice) {
      const face = s.bestDeal.faceValue || s.bestDeal.originalPrice;
      if (face) {
        return `\$${s.bestDeal.sellingPrice.toFixed(2)} on \$${face.toFixed(2)} ${s.bestDeal.faceValueCurrency || 'USD'} face`;
      }
      return `\$${s.bestDeal.sellingPrice.toFixed(2)}`;
    }
    if (s.faceAnalytics?.peakDiscountFace && s.faceAnalytics.peakDiscountFace.minPrice) {
      const pf = s.faceAnalytics.peakDiscountFace;
      return `\$${pf.minPrice.toFixed(2)} on \$${pf.faceValue.toFixed(2)} ${pf.currency || 'USD'} face`;
    }
    return 'No price data';
  }

  getMostFrequentFace(s: PageDealStatus): {
    faceValue: number | string;
    title: string;
    url: string | null;
    timesText: string;
    avgPct: string;
  } {
    const mf = s.faceAnalytics?.mostFrequentFace;
    if (mf) {
      let title = mf.title;
      let url = mf.url;
      if (!title || !url) {
        const match =
          s.rankedDeals?.find((d) => d.faceValue === mf.faceValue) ||
          s.topDeals?.find((d) => d.faceValue === mf.faceValue) ||
          s.faceAnalytics?.faceValues?.find((f) => f.faceValue === mf.faceValue) ||
          this.allDeals.find(
            (d) => d.faceValue === mf.faceValue && this.getCanonicalTargetKey(d) === this.getCanonicalTargetKey(s),
          );
        if (match) {
          title = title || match.title;
          url = url || match.url;
        }
      }
      if (!title) {
        const cardBase = s.targetName || s.name || s.category;
        title = `${cardBase} \$${mf.faceValue}`;
      }
      return {
        faceValue: mf.faceValue,
        title,
        url: url || s.pageUrl || null,
        timesText: `${mf.timesDiscounted} times`,
        avgPct: mf.avgDiscountPct.toFixed(1),
      };
    }
    if (s.rankedDeals && s.rankedDeals.length > 0) {
      const discounted = s.rankedDeals.filter((d) => d.discountPct > 0 && d.faceValue);
      const chosen = discounted.length > 0 ? discounted[0] : s.rankedDeals[0];
      if (chosen && chosen.faceValue) {
        return {
          faceValue: chosen.faceValue,
          title: chosen.title || `${s.targetName || s.name || s.category} \$${chosen.faceValue}`,
          url: chosen.url || s.pageUrl || null,
          timesText: 'most runs',
          avgPct: chosen.discountPct.toFixed(1),
        };
      }
    }
    return { faceValue: '—', title: '—', url: null, timesText: 'N/A', avgPct: '0.0' };
  }

  getPeakFace(s: PageDealStatus): {
    faceValue: number | string;
    title: string;
    url: string | null;
    peakPct: string;
    minPrice: string;
    savings: string;
  } {
    const pf = s.faceAnalytics?.peakDiscountFace;
    if (pf) {
      let title = pf.title;
      let url = pf.url;
      if (!title || !url) {
        const match =
          s.rankedDeals?.find((d) => d.faceValue === pf.faceValue) ||
          s.topDeals?.find((d) => d.faceValue === pf.faceValue) ||
          s.faceAnalytics?.faceValues?.find((f) => f.faceValue === pf.faceValue) ||
          this.allDeals.find(
            (d) => d.faceValue === pf.faceValue && this.getCanonicalTargetKey(d) === this.getCanonicalTargetKey(s),
          );
        if (match) {
          title = title || match.title;
          url = url || match.url;
        }
      }
      if (!title) {
        const cardBase = s.targetName || s.name || s.category;
        title = `${cardBase} \$${pf.faceValue}`;
      }
      return {
        faceValue: pf.faceValue,
        title,
        url: url || s.pageUrl || null,
        peakPct: pf.maxDiscountPct.toFixed(1),
        minPrice: pf.minPrice.toFixed(2),
        savings: (pf.savingsAmount || (pf.faceValue - pf.minPrice)).toFixed(2),
      };
    }
    if (s.bestDeal && s.bestDeal.faceValue) {
      const sv = s.bestDeal.savingsAmount || ((s.bestDeal.faceValue || 0) - s.bestDeal.sellingPrice);
      return {
        faceValue: s.bestDeal.faceValue,
        title: s.bestDeal.title || `${s.targetName || s.name || s.category} \$${s.bestDeal.faceValue}`,
        url: s.bestDeal.url || s.pageUrl || null,
        peakPct: s.bestDeal.discountPct.toFixed(1),
        minPrice: s.bestDeal.sellingPrice.toFixed(2),
        savings: sv > 0 ? sv.toFixed(2) : '0.00',
      };
    }
    return { faceValue: '—', title: '—', url: null, peakPct: '0.0', minPrice: '—', savings: '0.00' };
  }

  getFaceValuesList(s: PageDealStatus): FaceValueStatItem[] {
    if (s.faceAnalytics?.faceValues && s.faceAnalytics.faceValues.length > 0) {
      return s.faceAnalytics.faceValues;
    }
    if (s.rankedDeals && s.rankedDeals.length > 0) {
      const map = new Map<number, FaceValueStatItem>();
      for (const d of s.rankedDeals) {
        if (d.faceValue && d.faceValue > 0) {
          const fv = d.faceValue;
          const curr = map.get(fv);
          if (!curr || d.discountPct > curr.discountPct) {
            map.set(fv, {
              faceValue: fv,
              title: d.title,
              url: d.url,
              currency: d.faceValueCurrency || 'USD',
              discountPct: d.discountPct,
              sellingPrice: d.sellingPrice,
              savingsAmount: d.savingsAmount || 0,
            });
          }
        }
      }
      return Array.from(map.values()).sort((a, b) => a.faceValue - b.faceValue);
    }
    return [];
  }

  getScrapeCount(s: PageDealStatus): number {
    if (s.scrapeCount && s.scrapeCount > 0) return s.scrapeCount;
    const history = this.apiService.dashboardData()?.history || [];
    return history.length > 0 ? history.length : 1;
  }

  getStorePageUrl(s: Partial<PageDealStatus>): string {
    const id = (s.scrapeTargetId || s.targetId || '').trim();
    if (id && CANONICAL_TARGET_URLS[id]) {
      return CANONICAL_TARGET_URLS[id];
    }
    const key = this.getCanonicalTargetKey(s);
    if (key && CANONICAL_CATEGORY_URLS[key]) {
      return CANONICAL_CATEGORY_URLS[key];
    }
    if (s.pageUrl && s.pageUrl.startsWith('http')) {
      return s.pageUrl;
    }
    const prov = (s.provider || s.category || this.provider).toLowerCase();
    if (prov === 'g2a') {
      return 'https://www.g2a.com';
    }
    return 'https://www.eneba.com/store/gift-cards';
  }

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
    const statuses = this.sortedCategories;

    const hasHistoryDeal = history.some((h) => {
      const deal = (h as any).bestDealsByProvider?.[this.provider] || h.bestDeal;
      if (!deal) return false;
      return this.getCanonicalProvider(deal) === this.provider;
    });

    const hasStatusDeal = statuses.some(
      (s) => s.bestDeal || s.bestEffectiveDeal || (s.rankedDeals && s.rankedDeals.length > 0),
    );

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

  getCanonicalProvider(s: {
    provider?: string;
    category?: string;
    pageUrl?: string;
    url?: string;
    name?: string;
    targetName?: string;
    categoryName?: string;
  }): string {
    const url = (s.pageUrl || s.url || '').toLowerCase();
    const name = (s.targetName || s.name || s.categoryName || '').toLowerCase();
    const rawProv = (s.provider || s.category || '').toLowerCase().trim();

    if (url.includes('g2a.com') || name.includes('(g2a)') || name.includes(' g2a') || rawProv === 'g2a') {
      return 'g2a';
    }
    if (url.includes('eneba.com') || name.includes('(eneba)') || name.includes(' eneba') || rawProv === 'eneba') {
      return 'eneba';
    }
    return rawProv || 'eneba';
  }

  getCanonicalTargetKey(s: Partial<PageDealStatus> | any): string {
    if (!s) return '';
    const prov = this.getCanonicalProvider(s);
    const raw = `${s.scrapeTargetId || ''} ${s.targetId || ''} ${s.targetName || ''} ${s.name || ''} ${s.categoryName || ''} ${s.pageUrl || ''} ${s.url || ''}`.toLowerCase();

    if (raw.includes('playstation') || raw.includes('psn')) return `${prov}:psn`;
    if (raw.includes('nintendo') || raw.includes('eshop')) return `${prov}:nintendo`;
    if (raw.includes('google') || raw.includes('android') || raw.includes('play store')) return `${prov}:google-play`;
    if (raw.includes('amazon')) return `${prov}:amazon`;
    if (raw.includes('apple') || raw.includes('itunes') || raw.includes('app store')) return `${prov}:apple`;
    if (raw.includes('steam')) return `${prov}:steam`;

    const fallback = (
      s.targetName ||
      s.name ||
      s.categoryName ||
      s.scrapeTargetId ||
      s.targetId ||
      s.pageUrl ||
      s.category ||
      ''
    )
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');

    return `${prov}:${fallback}`;
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
      const resolvedProvider = this.getCanonicalProvider(s);
      return resolvedProvider === this.provider;
    });

    // Ensure all configured pages for this provider are represented
    const configuredPages = (data.pages || []).filter((p) => {
      const pProv = (p.provider || p.category || '').toLowerCase();
      return pProv === this.provider && p.enabled !== false;
    });

    for (const page of configuredPages) {
      const pKey = this.getCanonicalTargetKey(page);
      const pId = (page.id || '').trim();
      const pName = (page.name || page.categoryName || page.productTitle || '').trim().toLowerCase();
      const pUrl = (page.url || '').trim().toLowerCase();

      const exists = statuses.some((st) => {
        const stKey = this.getCanonicalTargetKey(st);
        if (pKey && stKey && pKey === stKey) return true;
        const stId = (st.scrapeTargetId || st.targetId || '').trim();
        if (pId && stId && pId === stId) return true;
        const stName = (st.targetName || st.name || '').trim().toLowerCase();
        if (pName && stName && pName === stName) return true;
        const stUrl = (st.pageUrl || '').trim().toLowerCase();
        if (pUrl && stUrl && (pUrl === stUrl || pUrl.split('?')[0] === stUrl.split('?')[0])) return true;
        return false;
      });

      if (!exists) {
        statuses.push({
          category: this.provider,
          provider: this.provider,
          scrapeTargetId: page.id,
          targetId: page.id,
          targetName: page.name || page.categoryName || page.productTitle || 'Monitored Page',
          name: page.name || page.categoryName || page.productTitle || 'Monitored Page',
          pageUrl: page.url,
          pageNumber: 1,
          totalListings: 0,
          inStockCount: 0,
          outOfStockCount: 0,
          discountedCount: 0,
          averageDiscountPctOnDiscounted: 0,
          averageDiscountPctAllInStock: 0,
          averageEffectiveDiscountPct: 0,
          maxDiscountPct: 0,
          maxEffectiveDiscountPct: 0,
          bestDeal: null,
          bestEffectiveDeal: null,
          bestDealOffers: [],
          topDeals: [],
          rankedDeals: [],
          scrapedAt: page.createdAt || new Date().toISOString(),
          runStatus: 'idle',
        });
      }
    }

    // Deduplicate by canonical target key, target ID, target name, or URL within this provider
    const deduplicatedStatuses: PageDealStatus[] = [];
    for (const st of statuses) {
      const stKey = this.getCanonicalTargetKey(st);
      const stId = (st.scrapeTargetId || st.targetId || '').trim();
      const stName = (st.targetName || st.name || '').trim().toLowerCase();
      const stUrl = (st.pageUrl || '').trim().toLowerCase();

      const exIdx = deduplicatedStatuses.findIndex((ex) => {
        const exKey = this.getCanonicalTargetKey(ex);
        if (stKey && exKey && stKey === exKey) return true;

        const exId = (ex.scrapeTargetId || ex.targetId || '').trim();
        if (stId && exId && stId === exId) return true;

        const exName = (ex.targetName || ex.name || '').trim().toLowerCase();
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
        const preferStName =
          Boolean(st.targetName || st.name) &&
          !(st.targetName || st.name)!.toLowerCase().startsWith('http');
        const preferExName =
          Boolean(deduplicatedStatuses[exIdx].targetName || deduplicatedStatuses[exIdx].name) &&
          !(deduplicatedStatuses[exIdx].targetName || deduplicatedStatuses[exIdx].name)!.toLowerCase().startsWith('http');
        const bestName = preferStName
          ? (st.targetName || st.name)
          : preferExName
            ? (deduplicatedStatuses[exIdx].targetName || deduplicatedStatuses[exIdx].name)
            : (st.targetName || deduplicatedStatuses[exIdx].targetName);

        const exHasData =
          deduplicatedStatuses[exIdx].totalListings > 0 ||
          Boolean(deduplicatedStatuses[exIdx].bestDeal) ||
          Boolean(deduplicatedStatuses[exIdx].rankedDeals && deduplicatedStatuses[exIdx].rankedDeals.length > 0);
        const stHasData =
          st.totalListings > 0 ||
          Boolean(st.bestDeal) ||
          Boolean(st.rankedDeals && st.rankedDeals.length > 0);
        const preserveExisting = !stHasData && exHasData;

        if (stTime >= exTime) {
          deduplicatedStatuses[exIdx] = {
            ...deduplicatedStatuses[exIdx],
            ...st,
            totalListings: preserveExisting ? deduplicatedStatuses[exIdx].totalListings : st.totalListings,
            inStockCount: preserveExisting ? deduplicatedStatuses[exIdx].inStockCount : st.inStockCount,
            discountedCount: preserveExisting ? deduplicatedStatuses[exIdx].discountedCount : st.discountedCount,
            averageDiscountPctAllInStock:
              st.averageDiscountPctAllInStock > 0
                ? st.averageDiscountPctAllInStock
                : deduplicatedStatuses[exIdx].averageDiscountPctAllInStock > 0
                  ? deduplicatedStatuses[exIdx].averageDiscountPctAllInStock
                  : st.averageDiscountPctAllInStock,
            bestDeal:
              st.bestDeal && st.bestDeal.discountPct > 0
                ? st.bestDeal
                : deduplicatedStatuses[exIdx].bestDeal && (deduplicatedStatuses[exIdx].bestDeal?.discountPct ?? 0) > 0
                  ? deduplicatedStatuses[exIdx].bestDeal
                  : (st.bestDeal || deduplicatedStatuses[exIdx].bestDeal),
            bestEffectiveDeal: st.bestEffectiveDeal || deduplicatedStatuses[exIdx].bestEffectiveDeal,
            rankedDeals: st.rankedDeals?.length ? st.rankedDeals : deduplicatedStatuses[exIdx].rankedDeals,
            topDeals: st.topDeals?.length ? st.topDeals : deduplicatedStatuses[exIdx].topDeals,
            bestDealOffers: st.bestDealOffers?.length ? st.bestDealOffers : deduplicatedStatuses[exIdx].bestDealOffers,
            faceAnalytics: st.faceAnalytics || deduplicatedStatuses[exIdx].faceAnalytics,
            scrapeTargetId: st.scrapeTargetId || deduplicatedStatuses[exIdx].scrapeTargetId,
            targetId: st.targetId || deduplicatedStatuses[exIdx].targetId,
            targetName: bestName || st.targetName || deduplicatedStatuses[exIdx].targetName,
            name: bestName || st.name || deduplicatedStatuses[exIdx].name,
          };
        } else {
          deduplicatedStatuses[exIdx] = {
            ...st,
            ...deduplicatedStatuses[exIdx],
            scrapeTargetId: deduplicatedStatuses[exIdx].scrapeTargetId || st.scrapeTargetId,
            targetId: deduplicatedStatuses[exIdx].targetId || st.targetId,
            targetName: bestName || deduplicatedStatuses[exIdx].targetName || st.targetName,
            name: bestName || deduplicatedStatuses[exIdx].name || st.name,
            faceAnalytics: deduplicatedStatuses[exIdx].faceAnalytics || st.faceAnalytics,
          };
        }
      }
    }

    // 1 Scraping Task (configured page) = Exactly 1 Row in the table
    if (configuredPages.length > 0) {
      const taskRows: PageDealStatus[] = configuredPages.map((page) => {
        const pKey = this.getCanonicalTargetKey(page);
        const pId = (page.id || '').trim();
        const pName = (page.name || page.categoryName || page.productTitle || '').trim().toLowerCase();
        const pUrl = (page.url || '').trim().toLowerCase();

        // Find all matching status records for this task from latest statuses
        const matches = statuses.filter((st) => {
          const stKey = this.getCanonicalTargetKey(st);
          if (pKey && stKey && pKey === stKey) return true;
          const stId = (st.scrapeTargetId || st.targetId || '').trim();
          if (pId && stId && pId === stId) return true;
          const stName = (st.targetName || st.name || '').trim().toLowerCase();
          if (pName && stName && pName === stName) return true;
          const stUrl = (st.pageUrl || '').trim().toLowerCase();
          if (pUrl && stUrl && (pUrl === stUrl || pUrl.split('?')[0] === stUrl.split('?')[0])) return true;
          return false;
        });

        // Pick the best match with data, or the latest scrape
        let bestStatus: PageDealStatus | undefined;
        for (const m of matches) {
          if (!bestStatus) {
            bestStatus = m;
          } else {
            const mHasDiscount = (m.averageDiscountPctAllInStock > 0) || (m.bestDeal && m.bestDeal.discountPct > 0) || ((m.faceAnalytics?.peakDiscountFace?.maxDiscountPct ?? 0) > 0);
            const bestHasDiscount = (bestStatus.averageDiscountPctAllInStock > 0) || (bestStatus.bestDeal && bestStatus.bestDeal.discountPct > 0) || ((bestStatus.faceAnalytics?.peakDiscountFace?.maxDiscountPct ?? 0) > 0);

            const mHasData = m.totalListings > 0 || Boolean(m.bestDeal) || (m.rankedDeals && m.rankedDeals.length > 0) || Boolean(m.faceAnalytics);
            const bestHasData = bestStatus.totalListings > 0 || Boolean(bestStatus.bestDeal) || (bestStatus.rankedDeals && bestStatus.rankedDeals.length > 0) || Boolean(bestStatus.faceAnalytics);

            const mTime = new Date(m.scrapedAt || 0).getTime();
            const bestTime = new Date(bestStatus.scrapedAt || 0).getTime();

            if (mHasDiscount && !bestHasDiscount) {
              bestStatus = {
                ...bestStatus,
                ...m,
                scrapedAt: mTime > bestTime ? m.scrapedAt : bestStatus.scrapedAt,
              };
            } else if (!mHasDiscount && bestHasDiscount) {
              bestStatus = {
                ...m,
                ...bestStatus,
                scrapedAt: mTime > bestTime ? m.scrapedAt : bestStatus.scrapedAt,
              };
            } else if (mHasData && !bestHasData) {
              bestStatus = {
                ...bestStatus,
                ...m,
                scrapedAt: mTime > bestTime ? m.scrapedAt : bestStatus.scrapedAt,
              };
            } else if (!mHasData && bestHasData) {
              bestStatus = {
                ...m,
                ...bestStatus,
                scrapedAt: mTime > bestTime ? m.scrapedAt : bestStatus.scrapedAt,
              };
            } else if (mTime > bestTime) {
              bestStatus = {
                ...bestStatus,
                ...m,
                averageDiscountPctAllInStock:
                  m.averageDiscountPctAllInStock > 0
                    ? m.averageDiscountPctAllInStock
                    : (bestStatus.averageDiscountPctAllInStock || 0),
                bestDeal:
                  m.bestDeal && m.bestDeal.discountPct > 0
                    ? m.bestDeal
                    : (bestStatus.bestDeal || m.bestDeal),
                faceAnalytics: m.faceAnalytics || bestStatus.faceAnalytics,
              };
            } else {
              bestStatus = {
                ...m,
                ...bestStatus,
                averageDiscountPctAllInStock:
                  bestStatus.averageDiscountPctAllInStock > 0
                    ? bestStatus.averageDiscountPctAllInStock
                    : (m.averageDiscountPctAllInStock || 0),
                bestDeal:
                  bestStatus.bestDeal && bestStatus.bestDeal.discountPct > 0
                    ? bestStatus.bestDeal
                    : (m.bestDeal || bestStatus.bestDeal),
                faceAnalytics: bestStatus.faceAnalytics || m.faceAnalytics,
              };
            }
          }
        }

        const taskTitle = page.name || page.categoryName || page.productTitle || bestStatus?.targetName || 'Monitored Task';
        const canonicalPageUrl =
          (page.id && CANONICAL_TARGET_URLS[page.id]) ||
          CANONICAL_CATEGORY_URLS[pKey] ||
          page.url;

        if (bestStatus) {
          return {
            ...bestStatus,
            scrapeTargetId: page.id,
            targetId: page.id,
            targetName: taskTitle,
            name: taskTitle,
            pageUrl: canonicalPageUrl || bestStatus.pageUrl,
            provider: this.provider,
            category: this.provider,
            runStatus: bestStatus.runStatus || (bestStatus.totalListings > 0 ? 'success' : 'idle'),
          };
        }

        return {
          category: this.provider,
          provider: this.provider,
          scrapeTargetId: page.id,
          targetId: page.id,
          targetName: taskTitle,
          name: taskTitle,
          pageUrl: canonicalPageUrl,
          pageNumber: 1,
          totalListings: 0,
          inStockCount: 0,
          outOfStockCount: 0,
          discountedCount: 0,
          averageDiscountPctOnDiscounted: 0,
          averageDiscountPctAllInStock: 0,
          averageEffectiveDiscountPct: 0,
          maxDiscountPct: 0,
          maxEffectiveDiscountPct: 0,
          bestDeal: null,
          bestEffectiveDeal: null,
          bestDealOffers: [],
          topDeals: [],
          rankedDeals: [],
          scrapedAt: page.createdAt || new Date().toISOString(),
          runStatus: 'idle',
        };
      });

      this.sortedCategories = [...taskRows];
    } else {
      this.sortedCategories = [...deduplicatedStatuses];
    }

    // Gather categories
    this.availableCategories = Array.from(new Set(deduplicatedStatuses.map((s) => s.targetName || s.name || s.category)));

    // Gather all ranked deals across all matching categories, ensuring each gift card is unique
    const dealList: (RankedDeal & { scrapedAt?: string })[] = [];
    for (const st of deduplicatedStatuses) {
      const deals = st.rankedDeals || st.topDeals || [];
      const candidates = [...deals];
      if (st.bestDeal) {
        candidates.push(st.bestDeal);
      }
      if (st.bestEffectiveDeal) {
        candidates.push(st.bestEffectiveDeal);
      }
      for (const d of candidates) {
        if (!d || !d.title) continue;
        const dTitle = (d.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const dUrl = (d.url || '')
          .trim()
          .toLowerCase()
          .split('?')[0]
          .replace(/^https?:\/\/[^/]+/, '')
          .replace(/^\/(?:us|en|de|fr|es|it)\//, '/');

        const isProductUrl = (u: string) =>
          u.length > 5 &&
          !u.startsWith('/store') &&
          !u.startsWith('/category') &&
          !u.startsWith('/search');

        const existingIdx = dealList.findIndex((ex) => {
          const exTitle = (ex.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          if (dTitle && exTitle && dTitle === exTitle) return true;

          const exUrl = (ex.url || '')
            .trim()
            .toLowerCase()
            .split('?')[0]
            .replace(/^https?:\/\/[^/]+/, '')
            .replace(/^\/(?:us|en|de|fr|es|it)\//, '/');

          if (isProductUrl(dUrl) && isProductUrl(exUrl) && dUrl === exUrl) {
            return true;
          }
          return false;
        });

        if (existingIdx === -1) {
          dealList.push({ ...d, scrapedAt: st.scrapedAt });
        } else {
          const ex = dealList[existingIdx];
          const exTime = new Date(ex.scrapedAt || 0).getTime();
          const dTime = new Date(st.scrapedAt || 0).getTime();
          if (
            d.discountPct > ex.discountPct ||
            (d.discountPct === ex.discountPct && dTime >= exTime)
          ) {
            dealList[existingIdx] = { ...d, scrapedAt: st.scrapedAt };
          }
        }
      }
    }

    // Sort by discountPct descending by default (highest discount first)
    dealList.sort((a, b) => b.discountPct - a.discountPct);
    this.allDeals = dealList;
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
        case 'page':
        case 'category': return compare(a.targetName || a.name || a.category, b.targetName || b.name || b.category, isAsc);
        case 'lastScraped':
        case 'scrapedAt': return compare(new Date(a.scrapedAt || 0).getTime(), new Date(b.scrapedAt || 0).getTime(), isAsc);
        case 'scrapeCount': return compare(this.getScrapeCount(a), this.getScrapeCount(b), isAsc);
        case 'status':
        case 'inStockCount': return compare(a.totalListings || 0, b.totalListings || 0, isAsc);
        case 'averageDiscount':
        case 'averageDiscountPctAllInStock': return compare(this.getAvgDiscountPct(a), this.getAvgDiscountPct(b), isAsc);
        case 'latestDiscount': return compare(this.getLatestDealPct(a), this.getLatestDealPct(b), isAsc);
        case 'bestFace': return compare(parseFloat(this.getPeakFace(a).peakPct) || 0, parseFloat(this.getPeakFace(b).peakPct) || 0, isAsc);
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
    const statuses = this.sortedCategories;
    let maxPct = 0;

    for (const h of history) {
      const providerDeal =
        (h as any).bestDealsByProvider?.[this.provider] ||
        (h.bestDeal && this.getCanonicalProvider(h.bestDeal) === this.provider ? h.bestDeal : null);

      if (providerDeal && (providerDeal.discountPct || 0) > maxPct) {
        maxPct = providerDeal.discountPct;
      }
    }

    for (const s of statuses) {
      const d = s.bestDeal || s.bestEffectiveDeal;
      if (d && (d.discountPct || 0) > maxPct) {
        maxPct = d.discountPct;
      }
      for (const deal of s.rankedDeals || s.topDeals || []) {
        if (deal && (deal.discountPct || 0) > maxPct) {
          maxPct = deal.discountPct;
        }
      }
    }

    return maxPct > 0 ? `${maxPct.toFixed(1)}%` : '—';
  }

  private renderBestDiscountChart(): void {
    if (!this.bestDiscountChartContainerRef?.nativeElement) return;

    const data = this.apiService.dashboardData();
    const history = data?.history || [];
    const statuses = this.sortedCategories;

    // Collect historical points strictly for THIS provider
    const providerPoints: {
      timestamp: string;
      deal: {
        title: string;
        category: string;
        provider?: string;
        sellerName: string;
        cost: number;
        faceValue: number;
        discountPct: number;
        url?: string;
      };
      pct: number;
    }[] = [];

    for (const h of history) {
      const provDeal =
        (h as any).bestDealsByProvider?.[this.provider] ||
        (h.bestDeal && this.getCanonicalProvider(h.bestDeal) === this.provider ? h.bestDeal : null);

      if (provDeal && (provDeal.discountPct || 0) > 0) {
        providerPoints.push({
          timestamp: h.timestamp,
          deal: {
            title: provDeal.title,
            category: provDeal.category || this.providerDisplayName,
            provider: this.provider,
            sellerName: provDeal.sellerName || 'Top Merchant',
            cost: provDeal.cost ?? 0,
            faceValue: provDeal.faceValue ?? 0,
            discountPct: provDeal.discountPct,
            url: provDeal.url,
          },
          pct: Number(provDeal.discountPct.toFixed(1)),
        });
      }
    }

    // Fallback: If no provider-specific history points yet, derive from current statuses for THIS provider
    if (providerPoints.length === 0 && statuses.length > 0) {
      let bestItem: any = null;
      let highest = -1;

      for (const st of statuses) {
        const top = st.bestDeal || st.bestEffectiveDeal || (st.rankedDeals && st.rankedDeals[0]);
        if (top && (top.discountPct || 0) > highest) {
          highest = top.discountPct;
          bestItem = {
            title: top.title,
            category: st.targetName || st.name || st.category,
            provider: this.provider,
            sellerName:
              (st.bestDealOffers && st.bestDealOffers[0]?.sellerName) ||
              top.lowestSellerName ||
              'Top Merchant',
            cost: top.sellingPrice ?? 0,
            faceValue: top.faceValue ?? top.originalPrice ?? 0,
            discountPct: top.discountPct,
            url: top.url,
          };
        }
      }

      if (bestItem) {
        providerPoints.push({
          timestamp: statuses[0].scrapedAt,
          deal: bestItem,
          pct: Number(bestItem.discountPct.toFixed(1)),
        });
      }
    }

    if (providerPoints.length === 0) {
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

    const categories = providerPoints.map((p, idx) => {
      const d = new Date(p.timestamp);
      if (isNaN(d.getTime())) return `Run #${idx + 1}`;
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    });

    const values = providerPoints.map((p) => p.pct);

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
          const point = providerPoints[idx];
          if (!point) return '';
          const d = point.deal;
          const fullTime = isNaN(new Date(point.timestamp).getTime())
            ? 'Recent Scrape'
            : new Date(point.timestamp).toLocaleString();
          if (!d) {
            return `<div style="font-weight:600;">🕒 ${escapeHtml(fullTime)}</div><div>Discount: <strong>${p.value}%</strong></div>`;
          }
          const costStr = d.cost != null ? '$' + Number(d.cost).toFixed(2) : 'N/A';
          const faceStr = d.faceValue != null ? '$' + Number(d.faceValue).toFixed(2) : 'N/A';
          const discountStr = (d.discountPct || p.value || 0).toFixed(1) + '%';
          const sellerStr = d.sellerName || 'Top Merchant';
          return `
            <div style="font-weight:700;margin-bottom:6px;color:${isDark ? '#f8fafc' : '#0f172a'};">
              🕒 ${escapeHtml(fullTime)} — ${this.providerDisplayName}
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
        boundaryGap: providerPoints.length <= 1,
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
          showSymbol: providerPoints.length < 35,
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
