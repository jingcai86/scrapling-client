import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import type { SellerOffer } from '../core/models/dashboard.model';

@Component({
  selector: 'app-seller-offers-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
  ],
  template: `
    <div class="dialog-header">
      <div>
        <h2 mat-dialog-title class="dialog-title">Competing Seller Offers</h2>
        <p class="dialog-subtitle">{{ data.title }}</p>
      </div>
      <button mat-icon-button mat-dialog-close aria-label="Close">
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <div mat-dialog-content class="dialog-body">
      <table
        mat-table
        [dataSource]="data.offers"
        class="data-table"
        *ngIf="data.offers.length > 0; else emptyTpl"
      >
        <ng-container matColumnDef="position">
          <th mat-header-cell *matHeaderCellDef>#</th>
          <td mat-cell *matCellDef="let offer; let i = index" class="num-cell">
            <span class="rank-pill">#{{ offer.position || i + 1 }}</span>
          </td>
        </ng-container>

        <ng-container matColumnDef="sellerName">
          <th mat-header-cell *matHeaderCellDef>Merchant</th>
          <td mat-cell *matCellDef="let offer">
            <span class="merchant-name">{{ offer.sellerName }}</span>
          </td>
        </ng-container>

        <ng-container matColumnDef="price">
          <th mat-header-cell *matHeaderCellDef>Price</th>
          <td mat-cell *matCellDef="let offer" class="num-cell price-strong">
            \${{ offer.price.toFixed(2) }}
          </td>
        </ng-container>

        <ng-container matColumnDef="priceWithServiceFee">
          <th mat-header-cell *matHeaderCellDef>With Fee</th>
          <td mat-cell *matCellDef="let offer" class="num-cell muted-cell">
            {{ offer.priceWithServiceFee ? '$' + offer.priceWithServiceFee.toFixed(2) : '—' }}
          </td>
        </ng-container>

        <ng-container matColumnDef="rating">
          <th mat-header-cell *matHeaderCellDef>Rating</th>
          <td mat-cell *matCellDef="let offer" class="num-cell">
            <span class="rating-pill" *ngIf="offer.ratingScore">
              {{ offer.ratingScore }}%
              <span *ngIf="offer.ratingCount" class="rating-count">({{ offer.ratingCount }})</span>
            </span>
            <span *ngIf="!offer.ratingScore" class="muted-cell">—</span>
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="columns"></tr>
        <tr mat-row *matRowDef="let row; columns: columns;"></tr>
      </table>

      <ng-template #emptyTpl>
        <div class="empty-state">
          <mat-icon>storefront</mat-icon>
          <p>No competing seller offers recorded for this listing.</p>
        </div>
      </ng-template>
    </div>

    <div mat-dialog-actions align="end" class="dialog-actions">
      <button mat-flat-button color="primary" mat-dialog-close>Close</button>
    </div>
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
    }
    .dialog-subtitle {
      margin: 0.25rem 0 0;
      font-size: 0.8125rem;
      color: var(--mat-sys-on-surface-variant);
    }
    .dialog-body {
      padding: 0 !important;
      max-height: 60vh;
      overflow-y: auto;
      scrollbar-gutter: stable;
      overscroll-behavior: contain;
    }
    .data-table {
      width: 100%;
    }
    .num-cell {
      font-variant-numeric: tabular-nums;
    }
    .price-strong {
      font-weight: 600;
      color: var(--status-success);
    }
    .merchant-name {
      font-weight: 500;
    }
    .muted-cell {
      color: var(--mat-sys-on-surface-variant);
    }
    .rank-pill {
      display: inline-block;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--mat-sys-on-surface-variant);
    }
    .rating-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.78rem;
      font-weight: 500;
      padding: 0.15rem 0.45rem;
      border-radius: 6px;
      border: 1px solid var(--ui-border);
      background: var(--surface-subtle);
      .rating-count {
        color: var(--mat-sys-on-surface-variant);
        font-size: 0.72rem;
      }
    }
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      padding: 2.5rem 1.5rem;
      color: var(--mat-sys-on-surface-variant);
    }
    .dialog-actions {
      padding: 0.875rem 1.5rem !important;
      border-top: 1px solid var(--ui-border);
      margin: 0 !important;
    }
  `],
})
export class SellerOffersDialogComponent {
  columns = ['position', 'sellerName', 'price', 'priceWithServiceFee', 'rating'];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { title: string; offers: SellerOffer[] },
  ) {}
}
