import { Injectable, Inject, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import type { DashboardData, ScrapePageConfig, SellerOffer } from '../models/dashboard.model';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  readonly dashboardData = signal<DashboardData | null>(null);
  readonly isLoading = signal<boolean>(false);
  private pollInterval?: any;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: object,
  ) {
    if (isPlatformBrowser(this.platformId)) {
      this.loadDashboard();
      this.pollInterval = setInterval(() => this.loadDashboard(false), 2500);
    }
  }

  loadDashboard(showLoading = true): void {
    if (showLoading && !this.dashboardData()) {
      this.isLoading.set(true);
    }
    this.http.get<DashboardData>('/api/dashboard').subscribe({
      next: (data) => {
        this.dashboardData.set(data);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  // Eneba Config
  updateEnebaConfig(updates: Record<string, string>): Observable<{ config: Record<string, string> }> {
    return this.http.put<{ config: Record<string, string> }>('/api/eneba/config', { updates }).pipe(
      tap(() => this.loadDashboard(false)),
    );
  }

  // Scraper Runner
  triggerScrape(opts: { pageId?: string; withOffers?: boolean }): Observable<any> {
    return this.http.post('/api/scrape', opts).pipe(
      tap(() => this.loadDashboard(false)),
    );
  }

  // Scrape Target Pages
  addPage(page: Partial<ScrapePageConfig>): Observable<{ page: ScrapePageConfig }> {
    return this.http.post<{ page: ScrapePageConfig }>('/api/pages', page).pipe(
      tap(() => this.loadDashboard(false)),
    );
  }

  updatePage(id: string, updates: Partial<ScrapePageConfig>): Observable<{ page: ScrapePageConfig }> {
    return this.http.patch<{ page: ScrapePageConfig }>(`/api/pages/${encodeURIComponent(id)}`, updates).pipe(
      tap(() => this.loadDashboard(false)),
    );
  }

  deletePage(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`/api/pages/${encodeURIComponent(id)}`).pipe(
      tap(() => this.loadDashboard(false)),
    );
  }

  // System & Database Config
  updateEnv(updates: Record<string, string>): Observable<any> {
    return this.http.put('/api/config', { updates }).pipe(
      tap(() => this.loadDashboard(false)),
    );
  }

  deleteEnvKey(key: string): Observable<any> {
    return this.http.delete(`/api/config/${encodeURIComponent(key)}`).pipe(
      tap(() => this.loadDashboard(false)),
    );
  }

  // Randomized Daily Cron Scheduler
  updateScheduler(config: { enabled?: boolean; baseTime?: string; jitterMinutes?: number }): Observable<any> {
    return this.http.put('/api/scheduler', config).pipe(
      tap(() => this.loadDashboard(false)),
    );
  }

  rerollScheduler(): Observable<any> {
    return this.http.put('/api/scheduler', { reroll: true }).pipe(
      tap(() => this.loadDashboard(false)),
    );
  }

  // Email Alerts
  previewEmail(): Observable<{ subject: string; html: string; isSampleData: boolean }> {
    return this.http.get<{ subject: string; html: string; isSampleData: boolean }>('/api/email/preview');
  }

  sendTestEmail(): Observable<{ sent: boolean; messageId?: string; error?: string; reason?: string }> {
    return this.http.post<{ sent: boolean; messageId?: string; error?: string; reason?: string }>('/api/email/test', {}).pipe(
      tap(() => this.loadDashboard(false)),
    );
  }
}
