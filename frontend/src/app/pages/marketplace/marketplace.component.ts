import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  HostListener,
  Inject,
  PLATFORM_ID,
  ChangeDetectorRef,
  effect,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subscription } from 'rxjs';
import * as echarts from 'echarts';
import { ApiService } from '../../core/services/api.service';
import { ThemeService } from '../../core/services/theme.service';
import type {
  PageDealStatus,
  RankedDeal,
  ScrapePageConfig,
  SchedulerState,
  FaceValueStatItem,
} from '../../core/models/dashboard.model';
import { SellerOffersDialogComponent } from '../../dialogs/seller-offers-dialog.component';
import { ProviderConfigDialogComponent } from '../../dialogs/provider-config-dialog.component';
import {
  CANONICAL_TARGET_URLS,
  CANONICAL_CATEGORY_URLS,
  getCanonicalProvider,
  getCanonicalTargetKey,
} from '../../core/utils/target.utils';
import {
  formatUtcBaseTimeToLocal,
  areSameScheduleIds,
  isDefaultScheduleId,
} from '../../core/utils/time.utils';

function compare(a: number | string, b: number | string, isAsc: boolean): number {
  return (a < b ? -1 : 1) * (isAsc ? 1 : -1);
}

@Component({
  selector: 'app-marketplace',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatCardModule,
    MatTableModule,
    MatSortModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="page-container">
      <!-- Page Header -->
      <div class="page-header">
        <div class="header-titles">
          <div class="title-with-badge">
            <h1>{{ providerDisplayName }}</h1>
            <span class="marketplace-pill">{{ categoriesCount() }} Monitored Targets</span>
          </div>
          <p class="subtitle">
            Live gift card discounts, competing merchant offers, and historical price telemetry for {{ providerDisplayName }}.
          </p>
        </div>

        <div class="header-actions">
          <button
            mat-stroked-button
            (click)="apiService.loadDashboard(true)"
            [disabled]="apiService.isLoading()"
          >
            <mat-icon>refresh</mat-icon>
            <span>Refresh</span>
          </button>

          <button
            mat-stroked-button
            (click)="openProviderConfigModal()"
          >
            <mat-icon>tune</mat-icon>
            <span>Settings</span>
          </button>

          <button
            mat-flat-button
            color="primary"
            (click)="triggerScrape()"
            [disabled]="apiService.dashboardData()?.runner?.isScraping"
          >
            <mat-icon>play_arrow</mat-icon>
            <span>Scrape {{ providerDisplayName }}</span>
          </button>
        </div>
      </div>

      <!-- 4 Clean SaaS KPI Cards -->
      <div class="kpi-grid">
        <!-- KPI 1: Best Live Discount -->
        <mat-card class="kpi-card" appearance="outlined">
          <div class="kpi-top">
            <span class="kpi-label">Best Live Discount</span>
            <span class="kpi-icon-box accent-emerald">
              <mat-icon>local_offer</mat-icon>
            </span>
          </div>
          <div class="kpi-metric-row">
            <span class="kpi-value accent-emerald-text">{{ bestDealPct() }}</span>
            <span class="kpi-pill" *ngIf="topBestDeals.length > 0 && topBestDeals[0].sellingPrice > 0">
              \${{ topBestDeals[0].sellingPrice.toFixed(2) }}
            </span>
          </div>
          <div class="kpi-footer-list" *ngIf="topBestDeals.length > 0; else noBestTpl">
            <a
              *ngFor="let deal of topBestDeals.slice(0, 2); let i = index"
              [href]="deal.url"
              target="_blank"
              rel="noopener noreferrer"
              class="kpi-deal-row"
            >
              <span class="deal-rank">#{{ i + 1 }}</span>
              <span class="deal-name">{{ deal.title }}</span>
              <span class="deal-price" *ngIf="deal.sellingPrice > 0">\${{ deal.sellingPrice.toFixed(2) }}</span>
              <span class="deal-pct" *ngIf="deal.discountPct > 0">-{{ deal.discountPct.toFixed(1) }}%</span>
            </a>
          </div>
          <ng-template #noBestTpl>
            <div class="kpi-sub">No active discounted deals yet</div>
          </ng-template>
        </mat-card>

        <!-- KPI 2: Next Scheduled Run -->
        <mat-card class="kpi-card" appearance="outlined" [matTooltip]="nextRunTooltip()">
          <div class="kpi-top">
            <span class="kpi-label">Next {{ providerDisplayName }} Run</span>
            <span class="kpi-icon-box accent-blue">
              <mat-icon>schedule</mat-icon>
            </span>
          </div>
          <div class="kpi-metric-row">
            <span class="kpi-value kpi-value-md">{{ nextRunTime() }}</span>
            <span class="kpi-pill pill-blue" *ngIf="nextRunCountdown()">
              {{ nextRunCountdown() }}
            </span>
          </div>
          <div class="kpi-sub">{{ nextRunWindow() }}</div>
          <div class="kpi-chip-row" *ngIf="nextRunTargetPages.length > 0">
            <span
              class="provider-chip"
              *ngFor="let p of nextRunTargetPages.slice(0, 3)"
              [matTooltip]="p.categoryName || p.name || ''"
            >
              {{ getPageShortName(p.categoryName || p.name) }}
            </span>
            <a
              *ngIf="nextRunTargetPages.length > 3"
              routerLink="/automation"
              class="provider-chip chip-more"
              [matTooltip]="'View all ' + nextRunTargetPages.length + ' scheduled targets'"
            >
              +{{ nextRunTargetPages.length - 3 }} more
            </a>
          </div>
        </mat-card>

        <!-- KPI 3: Historical Peak Discount -->
        <mat-card class="kpi-card" appearance="outlined">
          <div class="kpi-top">
            <span class="kpi-label">Historical Peak</span>
            <span class="kpi-icon-box accent-indigo">
              <mat-icon>trending_up</mat-icon>
            </span>
          </div>
          <div class="kpi-metric-row">
            <span class="kpi-value">{{ peakDiscountPct() }}</span>
            <span class="kpi-pill">Alert ≥{{ alertThresholdPct }}%</span>
          </div>
          <div class="kpi-sub">All-time highest discount captured on {{ providerDisplayName }}</div>
          <div class="kpi-links-row">
            <button type="button" class="kpi-inline-btn" (click)="selectTab('history')">
              <span>View discount chart</span>
              <mat-icon>arrow_forward</mat-icon>
            </button>
          </div>
        </mat-card>

        <!-- KPI 4: Active Inventory -->
        <mat-card class="kpi-card" appearance="outlined">
          <div class="kpi-top">
            <span class="kpi-label">In-Stock Cards</span>
            <span class="kpi-icon-box accent-amber">
              <mat-icon>inventory_2</mat-icon>
            </span>
          </div>
          <div class="kpi-metric-row">
            <span class="kpi-value">{{ totalInStock() }}</span>
            <span class="kpi-pill pill-emerald" *ngIf="totalDiscounted() > 0">
              {{ totalDiscounted() }} discounted
            </span>
          </div>
          <div class="kpi-sub">Across {{ categoriesCount() }} monitored {{ providerDisplayName }} targets</div>
          <div class="kpi-links-row">
            <button type="button" class="kpi-inline-btn" (click)="selectTab('targets')">
              <span>Inspect targets</span>
              <mat-icon>arrow_forward</mat-icon>
            </button>
          </div>
        </mat-card>
      </div>

      <!-- 1. Top Ranked Deals Table (Placed directly below KPIs for immediate visibility) -->
      <mat-card class="main-card" appearance="outlined">
        <mat-card-header class="table-header">
          <div>
            <mat-card-title>Top {{ topDealsLimit }} Ranked Deals</mat-card-title>
            <mat-card-subtitle>
              Highest-discount in-stock gift cards from the latest {{ providerDisplayName }} scrape.
            </mat-card-subtitle>
          </div>

          <div class="filter-controls">
            <mat-form-field appearance="outline" class="search-field" subscriptSizing="dynamic">
              <mat-icon matPrefix class="search-prefix-icon">search</mat-icon>
              <input
                matInput
                [(ngModel)]="searchQuery"
                (ngModelChange)="applyDealsFilter()"
                placeholder="Filter deals (e.g. PSN 100)..."
              />
              <button
                *ngIf="searchQuery"
                mat-icon-button
                matSuffix
                type="button"
                (click)="searchQuery = ''; applyDealsFilter()"
                aria-label="Clear filter"
              >
                <mat-icon>close</mat-icon>
              </button>
            </mat-form-field>

            <mat-form-field appearance="outline" class="select-field" subscriptSizing="dynamic">
              <mat-select [(ngModel)]="selectedCategory" (selectionChange)="applyDealsFilter()">
                <mat-option value="all">All Targets ({{ availableCategories.length }})</mat-option>
                <mat-option *ngFor="let cat of availableCategories" [value]="cat">{{ cat }}</mat-option>
              </mat-select>
            </mat-form-field>
          </div>
        </mat-card-header>

        <mat-card-content class="card-table-content table-wrapper-relative">
          <div *ngIf="isLoading" class="ui-loading-overlay">
            <mat-spinner diameter="32" strokeWidth="3"></mat-spinner>
            <span class="loading-label">Loading live ranked deals...</span>
          </div>

          <div class="table-wrapper" [class.table-loading-dimmed]="isLoading">
            <table
              mat-table
              [dataSource]="filteredDeals"
              matSort
              (matSortChange)="sortDeals($event)"
              class="data-table deals-table"
            >
              <ng-container matColumnDef="rank">
                <th mat-header-cell *matHeaderCellDef mat-sort-header class="col-rank">#</th>
                <td mat-cell *matCellDef="let deal; let i = index" class="col-rank num-cell">
                  <span class="rank-index">#{{ i + 1 }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="title">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Gift Card Listing</th>
                <td mat-cell *matCellDef="let deal">
                  <div class="deal-title-cell">
                    <a [href]="deal.url" target="_blank" rel="noopener noreferrer" class="deal-title-link">
                      {{ deal.title }}
                    </a>
                    <span
                      *ngIf="deal.discountPct >= alertThresholdPct"
                      class="alert-hit-badge"
                      title="Meets email alert threshold"
                    >
                      Alert ≥{{ alertThresholdPct }}%
                    </span>
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="category">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Target</th>
                <td mat-cell *matCellDef="let deal">
                  <span class="target-tag">{{ deal.targetName || deal.category }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="sellingPrice">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Price</th>
                <td mat-cell *matCellDef="let deal" class="num-cell">
                  <div class="price-stack">
                    <strong class="selling-price">\${{ deal.sellingPrice.toFixed(2) }}</strong>
                    <span
                      *ngIf="deal.originalPrice && deal.originalPrice > deal.sellingPrice"
                      class="strike-price"
                    >
                      \${{ deal.originalPrice.toFixed(2) }}
                    </span>
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="discountPct">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Discount</th>
                <td mat-cell *matCellDef="let deal" class="num-cell">
                  <span *ngIf="deal.discountPct > 0" class="discount-pill">
                    -{{ deal.discountPct.toFixed(1) }}%
                  </span>
                  <span *ngIf="!deal.discountPct" class="muted-text">0.0%</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="scrapedAt">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Updated</th>
                <td mat-cell *matCellDef="let deal" class="num-cell muted-text">
                  {{ formatTimeAgo(deal.scrapedAt) }}
                </td>
              </ng-container>

              <ng-container matColumnDef="url">
                <th mat-header-cell *matHeaderCellDef class="col-actions">Store</th>
                <td mat-cell *matCellDef="let deal" class="col-actions">
                  <a
                    [href]="deal.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    mat-stroked-button
                    class="btn-compact"
                  >
                    <span>Open</span>
                    <mat-icon class="ext-icon">open_in_new</mat-icon>
                  </a>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="dealColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: dealColumns;"></tr>
            </table>

            <div *ngIf="!isLoading && filteredDeals.length === 0" class="empty-table-state">
              <mat-icon>search_off</mat-icon>
              <span>No deals match your current filter.</span>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- 2. Tabbed Section: Monitored Targets & Discount History -->
      <mat-card class="main-card" appearance="outlined" id="analytics-tabs-card">
        <div class="tabs-header-bar">
          <div class="tabs-nav" role="tablist">
            <button
              type="button"
              role="tab"
              class="tab-btn"
              [class.active]="activeTab === 'targets'"
              [attr.aria-selected]="activeTab === 'targets'"
              (click)="selectTab('targets')"
            >
              <mat-icon>layers</mat-icon>
              <span>Monitored Targets</span>
              <span class="tab-count">{{ sortedCategories.length }}</span>
            </button>

            <button
              type="button"
              role="tab"
              class="tab-btn"
              [class.active]="activeTab === 'history'"
              [attr.aria-selected]="activeTab === 'history'"
              (click)="selectTab('history')"
            >
              <mat-icon>show_chart</mat-icon>
              <span>Discount History</span>
              <span class="tab-count" *ngIf="peakDiscountPct() !== '—'">Peak {{ peakDiscountPct() }}</span>
            </button>
          </div>

          <div class="tabs-right-meta">
            <span class="tab-hint" *ngIf="activeTab === 'targets'">
              Click any target row to expand face-value breakdown
            </span>
            <span class="tab-hint" *ngIf="activeTab === 'history'">
              Historical #1 discount captured across {{ providerDisplayName }} runs
            </span>
          </div>
        </div>

        <!-- TAB 1: Monitored Targets Table -->
        <mat-card-content
          *ngIf="activeTab === 'targets'"
          class="card-table-content table-wrapper-relative"
        >
          <div class="table-wrapper">
            <table
              mat-table
              [dataSource]="sortedCategories"
              multiTemplateDataRows
              matSort
              (matSortChange)="sortCategories($event)"
              class="data-table category-table"
            >
              <!-- Target Name Column -->
              <ng-container matColumnDef="page">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Target Page</th>
                <td mat-cell *matCellDef="let s" class="col-page">
                  <div class="page-cell-wrapper">
                    <mat-icon class="expand-chevron" [class.rotated]="isRowExpanded(s)">
                      chevron_right
                    </mat-icon>
                    <span class="status-dot" [attr.data-status]="s.runStatus || 'success'"></span>
                    <div class="page-title-stack">
                      <span class="page-name">{{ s.targetName || s.name || s.category }}</span>
                      <span class="page-sub-meta">
                        {{ s.inStockCount }}/{{ s.totalListings }} in stock · {{ getScrapeCount(s) }} runs
                      </span>
                    </div>
                  </div>
                </td>
              </ng-container>

              <!-- Average Discount Column -->
              <ng-container matColumnDef="averageDiscount">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Avg Discount</th>
                <td mat-cell *matCellDef="let s" class="num-cell">
                  <ng-container *ngIf="getAvgDiscountDisplay(s) as avgDisp">
                    <span
                      class="discount-pill"
                      *ngIf="avgDisp.hasDiscount"
                      [matTooltip]="avgDisp.tooltip || ''"
                    >
                      {{ avgDisp.text }}
                    </span>
                    <span *ngIf="!avgDisp.hasDiscount" class="muted-text">
                      {{ avgDisp.text }}
                    </span>
                  </ng-container>
                </td>
              </ng-container>

              <!-- Best Face Value Column -->
              <ng-container matColumnDef="bestFace">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Best Face Value</th>
                <td mat-cell *matCellDef="let s" class="num-cell">
                  <ng-container *ngIf="getPeakFace(s) as peak">
                    <div class="face-summary-cell" *ngIf="peak.faceValue !== '—'; else noFaceTpl">
                      <span class="face-tag">\${{ peak.faceValue }} Face</span>
                      <span class="face-sub">\${{ peak.minPrice }} (-{{ peak.peakPct }}%)</span>
                    </div>
                    <ng-template #noFaceTpl>
                      <span class="muted-text">—</span>
                    </ng-template>
                  </ng-container>
                </td>
              </ng-container>

              <!-- Last Scraped Column -->
              <ng-container matColumnDef="lastScraped">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Last Scraped</th>
                <td mat-cell *matCellDef="let s" class="num-cell">
                  <div class="time-stack">
                    <span class="time-ago">{{ formatTimeAgo(s.scrapedAt) }}</span>
                    <span class="time-exact">{{ formatScrapedAt(s.scrapedAt) }}</span>
                  </div>
                </td>
              </ng-container>

              <!-- Best Deal Column -->
              <ng-container matColumnDef="latestDiscount">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Best Deal</th>
                <td mat-cell *matCellDef="let s" class="num-cell">
                  <ng-container *ngIf="getLatestDealDisplay(s) as dealDisp">
                    <div class="best-deal-cell" *ngIf="dealDisp.hasDeal; else noDealCellTpl">
                      <span class="discount-pill" *ngIf="dealDisp.discountPct > 0">
                        -{{ dealDisp.discountPct.toFixed(1) }}%
                      </span>
                      <span class="best-price-text" *ngIf="dealDisp.price">
                        \${{ dealDisp.price }}
                      </span>
                      <button
                        *ngIf="s.bestDealOffers && s.bestDealOffers.length > 0"
                        mat-stroked-button
                        class="btn-xs"
                        (click)="openOffers(s); $event.stopPropagation()"
                      >
                        {{ s.bestDealOffers.length }} offers
                      </button>
                    </div>
                    <ng-template #noDealCellTpl>
                      <span class="muted-text">—</span>
                    </ng-template>
                  </ng-container>
                </td>
              </ng-container>

              <!-- Expanded Detail Row -->
              <ng-container matColumnDef="expandedDetail">
                <td mat-cell *matCellDef="let s" [attr.colspan]="categoryColumns.length" class="expanded-cell">
                  <div class="expanded-detail-panel" *ngIf="isRowExpanded(s)">
                    <div class="expanded-metrics-grid">
                      <!-- Card A: Most Frequent Face Value -->
                      <div class="detail-box" *ngIf="getMostFrequentFace(s) as mf">
                        <span class="detail-box-label">Most Frequent Discounted Denomination</span>
                        <div class="detail-box-main" *ngIf="mf.faceValue !== '—'; else noMfTpl">
                          <span class="denom-badge">\${{ mf.faceValue }} Face</span>
                          <span class="denom-stat">Avg -{{ mf.avgPct }}% ({{ mf.timesText }})</span>
                        </div>
                        <a
                          *ngIf="mf.url"
                          [href]="mf.url"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="detail-link"
                          (click)="$event.stopPropagation()"
                        >
                          {{ mf.title }} ↗
                        </a>
                        <ng-template #noMfTpl>
                          <span class="muted-text">No denomination history yet</span>
                        </ng-template>
                      </div>

                      <!-- Card B: Peak Discount Denomination -->
                      <div class="detail-box" *ngIf="getPeakFace(s) as pf">
                        <span class="detail-box-label">Highest Discounted Denomination</span>
                        <div class="detail-box-main" *ngIf="pf.faceValue !== '—'; else noPfTpl">
                          <span class="denom-badge">\${{ pf.faceValue }} Face</span>
                          <span class="denom-stat accent-emerald-text">
                            -{{ pf.peakPct }}% (\${{ pf.minPrice }} · Save \${{ pf.savings }})
                          </span>
                        </div>
                        <a
                          *ngIf="pf.url"
                          [href]="pf.url"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="detail-link"
                          (click)="$event.stopPropagation()"
                        >
                          {{ pf.title }} ↗
                        </a>
                        <ng-template #noPfTpl>
                          <span class="muted-text">No peak denomination data yet</span>
                        </ng-template>
                      </div>
                    </div>

                    <!-- All Denominations Strip -->
                    <div class="denominations-strip" *ngIf="getFaceValuesList(s).length > 0">
                      <span class="strip-title">Observed Denominations</span>
                      <div class="denom-pills-row">
                        <a
                          *ngFor="let face of getFaceValuesList(s)"
                          [href]="face.url || getStorePageUrl(s)"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="denom-pill"
                          (click)="$event.stopPropagation()"
                        >
                          <strong>\${{ face.faceValue }}</strong>
                          <span class="denom-price">\${{ face.sellingPrice.toFixed(2) }}</span>
                          <span class="denom-disc" *ngIf="face.discountPct > 0">
                            -{{ face.discountPct.toFixed(1) }}%
                          </span>
                        </a>
                      </div>
                    </div>

                    <div class="expanded-footer-bar">
                      <span>In Stock: <strong>{{ s.inStockCount }} / {{ s.totalListings }}</strong></span>
                      <span>Scraped: <strong>{{ formatScrapedAt(s.scrapedAt) }}</strong></span>
                      <a
                        [href]="getStorePageUrl(s)"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="store-ext-link"
                        (click)="$event.stopPropagation()"
                      >
                        Open {{ providerDisplayName }} Target Page ↗
                      </a>
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

        <!-- TAB 2: Discount History Chart -->
        <mat-card-content
          *ngIf="activeTab === 'history'"
          class="chart-card-content chart-wrapper-relative"
        >
          <div *ngIf="isLoading" class="ui-loading-overlay">
            <mat-spinner diameter="32" strokeWidth="3"></mat-spinner>
            <span class="loading-label">Loading historical discount trends...</span>
          </div>

          <div *ngIf="!isLoading && hasNoChartData" class="empty-chart">
            <mat-icon class="empty-icon">trending_up</mat-icon>
            <p>No historical discount deals recorded for {{ providerDisplayName }} yet.</p>
          </div>

          <div
            #bestDiscountChartContainer
            class="echarts-container"
            style="height: 340px; width: 100%;"
            [style.visibility]="!isLoading && !hasNoChartData ? 'visible' : 'hidden'"
          ></div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styleUrl: './marketplace.component.scss',
})
export class MarketplaceComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('bestDiscountChartContainer') bestDiscountChartContainerRef?: ElementRef<HTMLDivElement>;
  private chartInstance?: echarts.ECharts;
  private resizeObserver?: ResizeObserver;
  private routeSub?: Subscription;

  provider = 'eneba';
  activeTab: 'targets' | 'history' = 'targets';

  categoryColumns: string[] = [
    'page',
    'averageDiscount',
    'bestFace',
    'lastScraped',
    'latestDiscount',
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

  readonly getCanonicalProvider = getCanonicalProvider;
  readonly getCanonicalTargetKey = getCanonicalTargetKey;

  constructor(
    public apiService: ApiService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private themeService: ThemeService,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: object,
  ) {
    effect(() => {
      const data = this.apiService.dashboardData();
      const _theme = this.themeService.themeMode();
      if (data) {
        this.syncData();
        this.cdr.markForCheck();
        if (isPlatformBrowser(this.platformId) && this.activeTab === 'history') {
          setTimeout(() => this.renderBestDiscountChart(), 0);
        }
      }
    });
  }

  ngOnInit(): void {
    this.routeSub = this.route.url.subscribe(() => {
      const seg =
        this.route.snapshot.params['provider'] ||
        this.route.snapshot.url[0]?.path ||
        'eneba';
      this.provider = seg.toLowerCase();
      this.selectedCategory = 'all';
      this.searchQuery = '';
      this.syncData();
      this.cdr.markForCheck();
      if (isPlatformBrowser(this.platformId) && this.activeTab === 'history') {
        setTimeout(() => this.renderBestDiscountChart(), 0);
      }
    });
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId) && this.activeTab === 'history') {
      this.renderBestDiscountChart();
    }
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    this.resizeObserver?.disconnect();
    this.chartInstance?.dispose();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.chartInstance?.resize();
  }

  selectTab(tab: 'targets' | 'history'): void {
    this.activeTab = tab;
    if (tab === 'history' && isPlatformBrowser(this.platformId)) {
      this.chartInstance?.dispose();
      this.chartInstance = undefined;
      setTimeout(() => {
        this.renderBestDiscountChart();
        this.chartInstance?.resize();
      }, 20);
    }
  }

  get providerDisplayName(): string {
    return this.getProviderDisplayName(this.provider);
  }

  getProviderDisplayName(provider?: string | null): string {
    if (!provider) return 'Marketplace';
    const lower = provider.toLowerCase().trim();
    if (lower === 'g2a') return 'G2A';
    if (lower === 'eneba') return 'Eneba';
    return provider.charAt(0).toUpperCase() + provider.slice(1);
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
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
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

  getAvgDiscountDisplay(s: PageDealStatus): {
    text: string;
    hasDiscount: boolean;
    isMuted: boolean;
    tooltip?: string;
  } {
    const pct = this.getAvgDiscountPct(s);
    if (pct > 0) {
      return {
        text: `-${pct.toFixed(1)}%`,
        hasDiscount: true,
        isMuted: false,
        tooltip:
          s.averageDiscountPctAllInStock > 0
            ? `Average discount across in-stock listings: ${s.averageDiscountPctAllInStock.toFixed(1)}%`
            : `Observed discount on monitored denominations: ${pct.toFixed(1)}%`,
      };
    }
    if (s.totalListings > 0 || (s.rankedDeals && s.rankedDeals.length > 0)) {
      return {
        text: '0.0%',
        hasDiscount: false,
        isMuted: false,
      };
    }
    return { text: '—', hasDiscount: false, isMuted: true };
  }

  getLatestDealPct(s: PageDealStatus): number {
    if (s.bestDeal && s.bestDeal.discountPct > 0) return s.bestDeal.discountPct;
    if (s.bestEffectiveDeal && s.bestEffectiveDeal.discountPct > 0) return s.bestEffectiveDeal.discountPct;
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
        title: s.bestDeal.title || 'Best Deal Seen',
      };
    }
    if (s.bestEffectiveDeal && (s.bestEffectiveDeal.discountPct > 0 || (s.bestEffectiveDeal.sellingPrice && s.bestEffectiveDeal.sellingPrice > 0))) {
      return {
        hasDeal: true,
        discountPct: s.bestEffectiveDeal.discountPct || 0,
        price: s.bestEffectiveDeal.sellingPrice ? s.bestEffectiveDeal.sellingPrice.toFixed(2) : null,
        url: s.bestEffectiveDeal.url || null,
        title: s.bestEffectiveDeal.title || 'Best Deal Seen',
      };
    }
    if (s.rankedDeals && s.rankedDeals.length > 0) {
      const d = s.rankedDeals[0];
      return {
        hasDeal: true,
        discountPct: d.discountPct || 0,
        price: d.sellingPrice ? d.sellingPrice.toFixed(2) : null,
        url: d.url || null,
        title: d.title || 'Best Deal Seen',
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

  getMostFrequentFace(s: PageDealStatus): {
    faceValue: number | string;
    title: string;
    url: string | null;
    timesText: string;
    avgPct: string;
  } {
    const mf = s.faceAnalytics?.mostFrequentFace;
    if (mf) {
      return {
        faceValue: mf.faceValue,
        title: mf.title || `${s.targetName || s.name || s.category} $${mf.faceValue}`,
        url: mf.url || s.pageUrl || null,
        timesText: `${mf.timesDiscounted} runs`,
        avgPct: mf.avgDiscountPct.toFixed(1),
      };
    }
    if (s.rankedDeals && s.rankedDeals.length > 0) {
      const chosen = s.rankedDeals.find((d) => d.discountPct > 0 && d.faceValue) || s.rankedDeals[0];
      if (chosen?.faceValue) {
        return {
          faceValue: chosen.faceValue,
          title: chosen.title || `${s.targetName || s.name || s.category} $${chosen.faceValue}`,
          url: chosen.url || s.pageUrl || null,
          timesText: 'latest run',
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
      return {
        faceValue: pf.faceValue,
        title: pf.title || `${s.targetName || s.name || s.category} $${pf.faceValue}`,
        url: pf.url || s.pageUrl || null,
        peakPct: pf.maxDiscountPct.toFixed(1),
        minPrice: pf.minPrice.toFixed(2),
        savings: (pf.savingsAmount || pf.faceValue - pf.minPrice).toFixed(2),
      };
    }
    if (s.bestDeal && s.bestDeal.faceValue) {
      const sv = s.bestDeal.savingsAmount || (s.bestDeal.faceValue || 0) - s.bestDeal.sellingPrice;
      return {
        faceValue: s.bestDeal.faceValue,
        title: s.bestDeal.title || `${s.targetName || s.name || s.category} $${s.bestDeal.faceValue}`,
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
          const curr = map.get(d.faceValue);
          if (!curr || d.discountPct > curr.discountPct) {
            map.set(d.faceValue, {
              faceValue: d.faceValue,
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
    if (id && CANONICAL_TARGET_URLS[id]) return CANONICAL_TARGET_URLS[id];
    const key = this.getCanonicalTargetKey(s);
    if (key && CANONICAL_CATEGORY_URLS[key]) return CANONICAL_CATEGORY_URLS[key];
    if (s.pageUrl && s.pageUrl.startsWith('http')) return s.pageUrl;
    return this.provider === 'g2a' ? 'https://www.g2a.com' : 'https://www.eneba.com/store/gift-cards';
  }

  private syncData(): void {
    const data = this.apiService.dashboardData();
    if (!data) return;

    if (data.enebaConfig) {
      const limitKey = `${this.provider}_top_deals_limit`;
      const threshKey = `${this.provider}_alert_threshold_pct`;
      const rawLimit = data.enebaConfig[limitKey] || data.enebaConfig['top_deals_limit'];
      const rawThresh = data.enebaConfig[threshKey] || data.enebaConfig['alert_discount_threshold_pct'];
      if (rawLimit) this.topDealsLimit = Number(rawLimit) || 10;
      if (rawThresh) this.alertThresholdPct = Number(rawThresh) || (this.provider === 'g2a' ? 15 : 20);
    }

    const allStatuses = data.statuses || [];
    const statuses = allStatuses.filter((s) => this.getCanonicalProvider(s) === this.provider);

    const configuredPages = (data.pages || []).filter((p) => {
      const pProv = (p.provider || p.category || '').toLowerCase();
      return pProv === this.provider && p.enabled !== false;
    });

    const taskRows: PageDealStatus[] = configuredPages.map((page) => {
      const pKey = this.getCanonicalTargetKey(page);
      const pId = (page.id || '').trim();
      const pName = (page.name || page.categoryName || page.productTitle || '').trim().toLowerCase();
      const pUrl = (page.url || '').trim().toLowerCase();

      const matches = statuses.filter((st) => {
        const stKey = this.getCanonicalTargetKey(st);
        if (pKey && stKey && pKey === stKey) return true;
        const stId = (st.scrapeTargetId || st.targetId || '').trim();
        if (pId && stId && pId === stId) return true;
        const stName = (st.targetName || st.name || '').trim().toLowerCase();
        if (pName && stName && pName === stName) return true;
        const stUrl = (st.pageUrl || '').trim().toLowerCase();
        if (pUrl && stUrl && (pUrl === pUrl || stUrl.split('?')[0] === pUrl.split('?')[0])) return true;
        return false;
      });

      const bestStatus = matches[0];
      const taskTitle =
        page.name || page.categoryName || page.productTitle || bestStatus?.targetName || 'Monitored Target';
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

    this.sortedCategories = taskRows.length > 0 ? taskRows : statuses;
    this.availableCategories = Array.from(
      new Set(this.sortedCategories.map((s) => s.targetName || s.name || s.category)),
    );

    const dealList: (RankedDeal & { scrapedAt?: string })[] = [];
    for (const st of this.sortedCategories) {
      const targetLabel = st.targetName || st.name || st.category;
      const candidates = [...(st.rankedDeals || st.topDeals || [])];
      if (st.bestDeal) candidates.push(st.bestDeal);
      if (st.bestEffectiveDeal) candidates.push(st.bestEffectiveDeal);

      for (const d of candidates) {
        if (!d || !d.title) continue;
        const dTitle = d.title.toLowerCase().replace(/[^a-z0-9]/g, '');
        const existingIdx = dealList.findIndex(
          (ex) => ex.title.toLowerCase().replace(/[^a-z0-9]/g, '') === dTitle,
        );
        if (existingIdx === -1) {
          dealList.push({ ...d, targetName: d.targetName || targetLabel, scrapedAt: st.scrapedAt });
        } else if (d.discountPct > dealList[existingIdx].discountPct) {
          dealList[existingIdx] = { ...d, targetName: d.targetName || targetLabel, scrapedAt: st.scrapedAt };
        }
      }
    }

    dealList.sort((a, b) => b.discountPct - a.discountPct);
    this.allDeals = dealList;
    this.applyDealsFilter();
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

  getProviderActivePages(): ScrapePageConfig[] {
    const pages = this.apiService.dashboardData()?.pages || [];
    const provLower = this.provider.toLowerCase().trim();
    return pages.filter(
      (p) =>
        ((p.provider || p.category || '').toLowerCase().trim() === provLower ||
          (p.url && p.url.toLowerCase().includes(provLower))) &&
        p.enabled,
    );
  }

  getEarliestProviderScheduler(): SchedulerState | undefined {
    const data = this.apiService.dashboardData();
    if (!data) return undefined;

    const activePages = this.getProviderActivePages();
    if (activePages.length === 0) return undefined;

    const activePageIds = new Set(activePages.map((p) => p.id));
    const schedulers =
      data.schedulers && data.schedulers.length > 0
        ? data.schedulers
        : data.scheduler
          ? [data.scheduler]
          : [];

    const matching = schedulers.filter((s) => {
      if (!s.enabled) return false;
      if (s.assignedPageIds?.some((id) => activePageIds.has(id))) return true;
      return activePages.some((p) => areSameScheduleIds(p.scheduleId, s.id));
    });

    const withUpcoming = matching.filter(
      (s) => s.nextRunAt && !isNaN(new Date(s.nextRunAt).getTime()),
    );
    if (withUpcoming.length === 0) return matching[0];
    return withUpcoming.sort(
      (a, b) => new Date(a.nextRunAt!).getTime() - new Date(b.nextRunAt!).getTime(),
    )[0];
  }

  nextRunTime(): string {
    const data = this.apiService.dashboardData();
    if (!data) return 'Loading...';
    if (this.getProviderActivePages().length === 0) return 'No Active Targets';
    const sched = this.getEarliestProviderScheduler();
    if (!sched || !sched.enabled) return 'Paused';
    if (!sched.nextRunAt) return 'Pending';

    const nextDate = new Date(sched.nextRunAt);
    if (isNaN(nextDate.getTime())) return 'Pending';

    const now = new Date();
    const isToday = nextDate.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = nextDate.toDateString() === tomorrow.toDateString();
    const timeStr = nextDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

    if (isToday) return `Today, ${timeStr}`;
    if (isTomorrow) return `Tomorrow, ${timeStr}`;
    return `${nextDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
  }

  nextRunCountdown(): string {
    const sched = this.getEarliestProviderScheduler();
    if (!sched?.nextRunAt) return '';
    const diffMs = new Date(sched.nextRunAt).getTime() - Date.now();
    if (diffMs <= 0) return 'Soon';
    const totalMin = Math.floor(diffMs / 60000);
    const hours = Math.floor(totalMin / 60);
    const mins = totalMin % 60;
    if (hours > 0) return `in ${hours}h ${mins}m`;
    return `in ${mins}m`;
  }

  nextRunWindow(): string {
    if (this.getProviderActivePages().length === 0) return 'No enabled targets';
    const sched = this.getEarliestProviderScheduler();
    if (!sched || !sched.enabled) return 'Schedule paused';
    const localBase = formatUtcBaseTimeToLocal(sched.baseTime, this.apiService.getTimeZone());
    return `${sched.name || 'Primary Schedule'} · Base ${localBase} (+0..${sched.jitterMinutes}m)`;
  }

  nextRunTooltip(): string {
    const sched = this.getEarliestProviderScheduler();
    if (!sched?.nextRunAt) return `No scheduled scrape for ${this.providerDisplayName}`;
    const fullDate = new Date(sched.nextRunAt).toLocaleString();
    const localBase = formatUtcBaseTimeToLocal(sched.baseTime, this.apiService.getTimeZone());
    return `Next run: ${fullDate} (${sched.name || 'Primary Schedule'}, Base ${localBase} + 0..${sched.jitterMinutes}m jitter)`;
  }

  get nextRunTargetPages(): ScrapePageConfig[] {
    const sched = this.getEarliestProviderScheduler();
    const activePages = this.getProviderActivePages();
    if (!sched) return activePages;
    const assigned = activePages.filter((p) => areSameScheduleIds(p.scheduleId, sched.id));
    return assigned.length > 0 ? assigned : activePages;
  }

  getPageShortName(name?: string | null): string {
    if (!name) return 'Target';
    return (
      name
        .replace(/\s*\((?:G2A|Eneba)\)/i, '')
        .replace(/\s*Gift Cards(?:\s*&\s*Wallet Codes)?/i, '')
        .trim() || name
    );
  }

  get topBestDeals(): (RankedDeal & { scrapedAt?: string })[] {
    return this.allDeals.slice(0, 3);
  }

  bestDealPct(): string {
    const top = this.topBestDeals;
    if (top.length > 0 && top[0].discountPct > 0) {
      return `-${top[0].discountPct.toFixed(1)}%`;
    }
    const maxDisc = Math.max(...this.sortedCategories.map((s) => s.maxDiscountPct || 0), 0);
    return maxDisc > 0 ? `-${maxDisc.toFixed(1)}%` : '—';
  }

  get schedulersList(): SchedulerState[] {
    const data = this.apiService.dashboardData();
    if (data?.schedulers && data.schedulers.length > 0) return data.schedulers;
    if (data?.scheduler) return [data.scheduler];
    return [];
  }

  get providerPages(): ScrapePageConfig[] {
    const pages = this.apiService.dashboardData()?.pages || [];
    return pages.filter(
      (p) => (p.provider || p.category || '').toLowerCase() === this.provider,
    );
  }

  openProviderConfigModal(): void {
    const dialogRef = this.dialog.open(ProviderConfigDialogComponent, {
      data: {
        providerDisplayName: this.providerDisplayName,
        topDealsLimit: this.topDealsLimit,
        alertThresholdPct: this.alertThresholdPct,
        pages: this.providerPages,
        schedulers: this.schedulersList,
        timeZone: this.apiService.getTimeZone(),
      },
      width: '560px',
      maxWidth: '94vw',
    });

    dialogRef.afterClosed().subscribe((res) => {
      if (res) {
        this.topDealsLimit = res.topDealsLimit;
        this.alertThresholdPct = res.alertThresholdPct;
        this.saveProviderConfig();

        if (res.pageSchedules) {
          for (const [pageId, schedId] of Object.entries(res.pageSchedules)) {
            const page = this.providerPages.find((p) => p.id === pageId);
            if (page && !areSameScheduleIds(page.scheduleId, schedId as string)) {
              this.apiService.assignTargetSchedule(pageId, schedId as string).subscribe();
            }
          }
        }
      }
    });
  }

  saveProviderConfig(): void {
    const updates: Record<string, string> = {
      [`${this.provider}_top_deals_limit`]: String(this.topDealsLimit),
      [`${this.provider}_alert_threshold_pct`]: String(this.alertThresholdPct),
    };
    if (this.provider === 'eneba') {
      updates['top_deals_limit'] = String(this.topDealsLimit);
      updates['alert_discount_threshold_pct'] = String(this.alertThresholdPct);
    }
    this.apiService.updateProviderConfig(updates).subscribe(() => {
      this.applyDealsFilter();
      this.snackBar.open(`${this.providerDisplayName} settings saved`, 'OK', { duration: 3000 });
    });
  }

  triggerScrape(): void {
    this.apiService.triggerScrape({ provider: this.provider }).subscribe(() => {
      this.snackBar.open(`Started scrape for ${this.providerDisplayName}`, 'OK', { duration: 3000 });
    });
  }

  openOffers(status: PageDealStatus): void {
    this.dialog.open(SellerOffersDialogComponent, {
      data: {
        title:
          status.bestDeal?.title ||
          status.bestEffectiveDeal?.title ||
          `${status.targetName || status.category} Gift Cards`,
        offers: status.bestDealOffers || [],
      },
      width: '680px',
    });
  }

  applyDealsFilter(): void {
    const q = this.searchQuery.trim().toLowerCase();
    const cat = this.selectedCategory;

    const matched = this.allDeals.filter((deal) => {
      const dealCat = deal.targetName || deal.category;
      const matchCat = cat === 'all' || dealCat === cat || deal.category === cat;
      const matchQ =
        !q ||
        deal.title.toLowerCase().includes(q) ||
        (dealCat && dealCat.toLowerCase().includes(q));
      return matchCat && matchQ;
    });

    this.filteredDeals = matched.slice(0, this.topDealsLimit);
  }

  sortCategories(sort: Sort): void {
    const data = [...this.sortedCategories];
    if (!sort.active || sort.direction === '') {
      this.sortedCategories = data;
      return;
    }
    const isAsc = sort.direction === 'asc';
    this.sortedCategories = data.sort((a, b) => {
      switch (sort.active) {
        case 'page':
          return compare(a.targetName || a.name || a.category, b.targetName || b.name || b.category, isAsc);
        case 'lastScraped':
          return compare(new Date(a.scrapedAt || 0).getTime(), new Date(b.scrapedAt || 0).getTime(), isAsc);
        case 'averageDiscount':
          return compare(this.getAvgDiscountPct(a), this.getAvgDiscountPct(b), isAsc);
        case 'latestDiscount':
          return compare(this.getLatestDealPct(a), this.getLatestDealPct(b), isAsc);
        case 'bestFace':
          return compare(parseFloat(this.getPeakFace(a).peakPct) || 0, parseFloat(this.getPeakFace(b).peakPct) || 0, isAsc);
        default:
          return 0;
      }
    });
  }

  sortDeals(sort: Sort): void {
    if (!sort.active || sort.direction === '') {
      this.applyDealsFilter();
      return;
    }
    const isAsc = sort.direction === 'asc';
    this.filteredDeals = [...this.filteredDeals].sort((a, b) => {
      switch (sort.active) {
        case 'rank':
          return compare(this.filteredDeals.indexOf(a), this.filteredDeals.indexOf(b), isAsc);
        case 'title':
          return compare(a.title, b.title, isAsc);
        case 'category':
          return compare(a.targetName || a.category, b.targetName || b.category, isAsc);
        case 'sellingPrice':
          return compare(a.sellingPrice, b.sellingPrice, isAsc);
        case 'discountPct':
          return compare(a.discountPct, b.discountPct, isAsc);
        case 'scrapedAt':
          return compare(a.scrapedAt || '', b.scrapedAt || '', isAsc);
        default:
          return 0;
      }
    });
  }

  peakDiscountPct(): string {
    const data = this.apiService.dashboardData();
    const history = data?.history || [];
    let maxPct = 0;

    for (const h of history) {
      const deal =
        (h as any).bestDealsByProvider?.[this.provider] ||
        (h.bestDeal && this.getCanonicalProvider(h.bestDeal) === this.provider ? h.bestDeal : null);
      if (deal && (deal.discountPct || 0) > maxPct) {
        maxPct = deal.discountPct;
      }
    }
    for (const s of this.sortedCategories) {
      const d = s.bestDeal || s.bestEffectiveDeal;
      if (d && (d.discountPct || 0) > maxPct) maxPct = d.discountPct;
    }
    return maxPct > 0 ? `-${maxPct.toFixed(1)}%` : '—';
  }

  private renderBestDiscountChart(): void {
    const container = this.bestDiscountChartContainerRef?.nativeElement;
    if (!container) return;

    const data = this.apiService.dashboardData();
    const history = data?.history || [];
    const points: Array<{ timestamp: string; deal: any; pct: number }> = [];

    for (const h of history) {
      const provDeal =
        (h as any).bestDealsByProvider?.[this.provider] ||
        (h.bestDeal && this.getCanonicalProvider(h.bestDeal) === this.provider ? h.bestDeal : null);
      if (provDeal && (provDeal.discountPct || 0) > 0) {
        points.push({
          timestamp: h.timestamp,
          deal: provDeal,
          pct: Number(provDeal.discountPct.toFixed(1)),
        });
      }
    }

    if (points.length === 0 && this.sortedCategories.length > 0) {
      const top = this.topBestDeals[0];
      if (top && top.discountPct > 0) {
        points.push({
          timestamp: top.scrapedAt || new Date().toISOString(),
          deal: {
            title: top.title,
            cost: top.sellingPrice,
            faceValue: top.faceValue || top.originalPrice,
            discountPct: top.discountPct,
            sellerName: top.lowestSellerName || 'Top Merchant',
          },
          pct: Number(top.discountPct.toFixed(1)),
        });
      }
    }

    if (points.length === 0) return;

    points.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    if (!this.chartInstance) {
      this.chartInstance = echarts.init(container);
    }

    const mode = this.themeService.themeMode();
    const isDark =
      mode === 'dark' ||
      (mode === 'system' &&
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);

    const labels = points.map((p) => {
      const d = new Date(p.timestamp);
      return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    });
    const values = points.map((p) => p.pct);

    this.chartInstance.setOption({
      backgroundColor: 'transparent',
      grid: { top: 24, right: 20, bottom: 28, left: 45 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: isDark ? '#18181b' : '#ffffff',
        borderColor: isDark ? '#27272a' : '#e4e4e7',
        textStyle: { color: isDark ? '#f4f4f5' : '#18181b', fontSize: 12 },
        formatter: (params: any) => {
          const idx = params?.[0]?.dataIndex ?? 0;
          const p = points[idx];
          if (!p) return '';
          return `
            <div style="font-weight:600;margin-bottom:4px;">${p.deal.title}</div>
            <div>Discount: <strong style="color:#10b981;">-${p.pct}%</strong></div>
            <div>Price: <strong>$${Number(p.deal.cost || 0).toFixed(2)}</strong></div>
          `;
        },
      },
      xAxis: {
        type: 'category',
        data: labels,
        axisLine: { lineStyle: { color: isDark ? '#27272a' : '#e4e4e7' } },
        axisLabel: { color: isDark ? '#a1a1aa' : '#71717a', fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        axisLabel: { formatter: '{value}%', color: isDark ? '#a1a1aa' : '#71717a', fontSize: 11 },
        splitLine: { lineStyle: { color: isDark ? '#27272a' : '#f4f4f5', type: 'dashed' } },
      },
      series: [
        {
          name: 'Best Discount',
          type: 'line',
          smooth: true,
          symbolSize: 7,
          data: values,
          itemStyle: { color: '#10b981' },
          lineStyle: { width: 2.5, color: '#10b981' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(16, 185, 129, 0.22)' },
              { offset: 1, color: 'rgba(16, 185, 129, 0.0)' },
            ]),
          },
        },
      ],
    });
  }
}
