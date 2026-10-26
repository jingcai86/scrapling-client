import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { ThemeService } from '../../core/services/theme.service';
import { ApiService } from '../../core/services/api.service';
import { ConfigDialogComponent } from '../../dialogs/config-dialog.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    MatDialogModule,
  ],
  template: `
    <header class="app-header">
      <div class="header-inner">
        <a routerLink="/" class="brand" aria-label="Scrapling Monitor Home">
          <div class="brand-badge">S</div>
          <div class="brand-text">
            <h1>Scrapling Monitor</h1>
            <p>Multi-Provider Scraper • Randomized Cron • Resend Alerts</p>
          </div>
        </a>

        <div class="header-actions">
          <nav class="nav-links">
            <button mat-button type="button" class="nav-btn config-btn" (click)="openConfigModal()">
              <mat-icon class="nav-icon">settings</mat-icon>
              <span>Configuration</span>
            </button>
          </nav>

          <button
            mat-stroked-button
            class="theme-toggle-btn"
            [matMenuTriggerFor]="themeMenu"
            matTooltip="Change color theme (Light / Dark / System)"
            aria-label="Color scheme selection"
          >
            <mat-icon class="theme-icon" *ngIf="themeService.themeMode() === 'light'">light_mode</mat-icon>
            <mat-icon class="theme-icon" *ngIf="themeService.themeMode() === 'dark'">dark_mode</mat-icon>
            <mat-icon class="theme-icon" *ngIf="themeService.themeMode() === 'system'">desktop_windows</mat-icon>
            <span class="theme-label">Theme: {{ themeService.themeMode() === 'system' ? 'System' : (themeService.themeMode() | titlecase) }}</span>
            <mat-icon class="dropdown-arrow">arrow_drop_down</mat-icon>
          </button>

          <mat-menu #themeMenu="matMenu">
            <button mat-menu-item (click)="themeService.setTheme('light')">
              <mat-icon class="menu-icon">light_mode</mat-icon>
              <span>Light Theme</span>
              <mat-icon class="check-icon" *ngIf="themeService.themeMode() === 'light'">check</mat-icon>
            </button>
            <button mat-menu-item (click)="themeService.setTheme('dark')">
              <mat-icon class="menu-icon">dark_mode</mat-icon>
              <span>Dark Theme</span>
              <mat-icon class="check-icon" *ngIf="themeService.themeMode() === 'dark'">check</mat-icon>
            </button>
            <button mat-menu-item (click)="themeService.setTheme('system')">
              <mat-icon class="menu-icon">desktop_windows</mat-icon>
              <span>System Default</span>
              <mat-icon class="check-icon" *ngIf="themeService.themeMode() === 'system'">check</mat-icon>
            </button>
          </mat-menu>
        </div>
      </div>
    </header>
  `,
  styles: [`
    .app-header {
      background: var(--mat-sys-surface-container);
      border-bottom: 1px solid var(--mat-sys-outline-variant);
      position: sticky;
      top: 0;
      z-index: 100;
      backdrop-filter: blur(8px);
    }

    .header-inner {
      max-width: 1400px;
      margin: 0 auto;
      padding: 0.75rem 1.25rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      text-decoration: none;
      cursor: pointer;
      border-radius: 8px;
      transition: opacity 0.2s ease;
      &:hover {
        opacity: 0.9;
      }
    }

    .brand-badge {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: linear-gradient(135deg, #6366f1, #10b981);
      display: grid;
      place-items: center;
      font-weight: 800;
      font-size: 1.15rem;
      color: #fff;
    }

    .brand-text h1 {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 700;
      line-height: 1.2;
      color: var(--mat-sys-on-surface) !important;
    }

    .brand-text p {
      margin: 0;
      font-size: 0.78rem;
      color: var(--mat-sys-on-surface-variant);
    }

    .nav-links {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      flex-wrap: wrap;

      a, button {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        font-weight: 600;
        border-radius: 8px;
        padding: 0 0.85rem;
        height: 38px;
        color: var(--mat-sys-on-surface-variant);
        text-decoration: none;

        &.active {
          color: var(--mat-sys-primary);
          background: var(--mat-sys-primary-container);
        }
      }
    }

    .nav-icon {
      font-size: 1.15rem;
    }

    .badge {
      margin-left: 0.35rem;
      padding: 0.15rem 0.45rem;
      border-radius: 10px;
      font-size: 0.72rem;
      font-weight: 700;
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .theme-toggle-btn {
      display: inline-flex !important;
      align-items: center !important;
      gap: 0.35rem !important;
      border-radius: 20px !important;
      padding: 0 0.85rem !important;
      height: 36px !important;
      font-weight: 500 !important;
      font-size: 0.82rem !important;
      border-color: var(--mat-sys-outline-variant) !important;
      color: var(--mat-sys-on-surface) !important;
    }

    .theme-icon {
      font-size: 1.15rem !important;
      vertical-align: middle;
    }

    .theme-label {
      font-size: 0.82rem;
      font-weight: 600;
    }

    .dropdown-arrow {
      font-size: 1.15rem !important;
      opacity: 0.7;
    }

    .menu-icon {
      margin-right: 0.5rem;
      font-size: 1.2rem;
      vertical-align: middle;
    }

    .check-icon {
      margin-left: auto;
      font-size: 1.1rem;
      color: var(--mat-sys-primary);
    }
  `],
})
export class HeaderComponent {
  constructor(
    public themeService: ThemeService,
    private apiService: ApiService,
    private dialog: MatDialog,
  ) {}

  openConfigModal(): void {
    this.dialog.open(ConfigDialogComponent, {
      width: '1050px',
      maxWidth: '96vw',
      maxHeight: '92vh',
      autoFocus: false,
    });
  }

  pagesCount(): number {
    return this.apiService.dashboardData()?.pages?.length ?? 0;
  }
}
