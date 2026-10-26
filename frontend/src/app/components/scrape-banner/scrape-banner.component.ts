import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-scrape-banner',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule],
  template: `
    <div *ngIf="runner()?.isScraping" class="scrape-banner" role="status" aria-live="polite">
      <div class="banner-left">
        <mat-spinner diameter="24" strokeWidth="3"></mat-spinner>
        <div>
          <div class="step-text">{{ runner()?.currentStep || 'Scraping in progress...' }}</div>
          <div class="sub-text">Scraping enabled categories via Scrapling MCP engine...</div>
        </div>
      </div>
      <div class="badge">
        {{ runner()?.completedPages || 0 }} / {{ runner()?.totalPages || 0 }} Pages
      </div>
    </div>
  `,
  styles: [`
    .scrape-banner {
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
      border: 1px solid var(--mat-sys-primary);
      border-radius: 12px;
      padding: 0.85rem 1.25rem;
      margin-bottom: 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }

    .banner-left {
      display: flex;
      align-items: center;
      gap: 0.85rem;
    }

    .step-text {
      font-weight: 700;
      font-size: 0.95rem;
    }

    .sub-text {
      font-size: 0.8rem;
      opacity: 0.85;
    }

    .badge {
      background: var(--mat-sys-primary);
      color: var(--mat-sys-on-primary);
      padding: 0.35rem 0.75rem;
      border-radius: 9999px;
      font-weight: 700;
      font-size: 0.82rem;
    }
  `],
})
export class ScrapeBannerComponent {
  constructor(private apiService: ApiService) {}

  runner() {
    return this.apiService.dashboardData()?.runner;
  }
}
