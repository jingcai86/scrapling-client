import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule, Sort } from '@angular/material/sort';
import type { SellerOffer } from '../core/models/dashboard.model';

@Component({
  selector: 'app-seller-offers-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatTableModule, MatSortModule],
  template: `
    <h2 mat-dialog-title>Competing Third-Party Seller Offers</h2>
    <div mat-dialog-content>
      <p class="sub-title">{{ data.title }}</p>

      <div class="table-wrapper">
        <table mat-table [dataSource]="sortedOffers" matSort (matSortChange)="sortData($event)" class="offers-table">
          <ng-container matColumnDef="sellerName">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Seller / Merchant</th>
            <td mat-cell *matCellDef="let offer">
              <strong class="seller-name">{{ offer.sellerName }}</strong>
            </td>
          </ng-container>

          <ng-container matColumnDef="price">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Price</th>
            <td mat-cell *matCellDef="let offer" class="price-cell">
              <strong>\${{ offer.price.toFixed(2) }}</strong>
            </td>
          </ng-container>

          <ng-container matColumnDef="ratingScore">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Rating</th>
            <td mat-cell *matCellDef="let offer">
              <span *ngIf="offer.ratingScore > 0" class="badge badge-discount">★ {{ offer.ratingScore.toFixed(1) }}%</span>
              <span *ngIf="!offer.ratingScore" class="muted">—</span>
            </td>
          </ng-container>

          <ng-container matColumnDef="placement">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Placement</th>
            <td mat-cell *matCellDef="let offer">
              <span class="badge badge-region">{{ offer.placement || 'Organic' }}</span>
            </td>
          </ng-container>

          <ng-container matColumnDef="url">
            <th mat-header-cell *matHeaderCellDef>Vendor Link</th>
            <td mat-cell *matCellDef="let offer">
              <a [href]="offer.url" target="_blank" rel="noopener" mat-stroked-button color="primary" class="btn-xs">
                <span>Store Link ↗</span>
              </a>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
        </table>
      </div>
    </div>

    <div mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Close</button>
    </div>
  `,
  styles: [`
    .sub-title {
      font-size: 0.85rem;
      color: var(--mat-sys-on-surface-variant);
      margin: 0 0 1rem;
    }
    .offers-table {
      width: 100%;
      min-width: 580px;
    }
    .seller-name {
      font-weight: 600;
    }
    .price-cell {
      font-weight: 700;
      color: var(--mat-sys-primary);
    }
    .placement-badge {
      display: inline-block;
      padding: 0.15rem 0.45rem;
      border-radius: 6px;
      background: var(--mat-sys-surface-container-high);
      font-size: 0.75rem;
    }
    .offer-link {
      color: var(--mat-sys-primary);
      text-decoration: none;
      font-weight: 600;
      &:hover { text-decoration: underline; }
    }
    .muted {
      color: var(--mat-sys-outline);
    }
  `],
})
export class SellerOffersDialogComponent {
  displayedColumns: string[] = ['sellerName', 'price', 'ratingScore', 'placement', 'url'];
  sortedOffers: SellerOffer[] = [];

  constructor(@Inject(MAT_DIALOG_DATA) public data: { title: string; offers: SellerOffer[] }) {
    this.sortedOffers = [...(data.offers || [])];
  }

  sortData(sort: Sort) {
    const data = [...this.data.offers];
    if (!sort.active || sort.direction === '') {
      this.sortedOffers = data;
      return;
    }

    this.sortedOffers = data.sort((a, b) => {
      const isAsc = sort.direction === 'asc';
      switch (sort.active) {
        case 'sellerName': return compare(a.sellerName, b.sellerName, isAsc);
        case 'price': return compare(a.price, b.price, isAsc);
        case 'ratingScore': return compare(a.ratingScore, b.ratingScore, isAsc);
        case 'placement': return compare(a.placement, b.placement, isAsc);
        default: return 0;
      }
    });
  }
}

function compare(a: number | string, b: number | string, isAsc: boolean) {
  return (a < b ? -1 : 1) * (isAsc ? 1 : -1);
}
