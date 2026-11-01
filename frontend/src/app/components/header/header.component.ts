import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../../core/services/api.service';
import { ThemeService } from '../../core/services/theme.service';
import type { ThemeMode } from '../../core/models/dashboard.model';

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
  ],
  template: `
    <header class="app-header">
      <div class="header-inner">
        <!-- Brand & Main Nav -->
        <div class="header-left">
          <a routerLink="/" class="brand-link">
            <div class="brand-mark">
              <mat-icon>bolt</mat-icon>
            </div>
            <span class="brand-name">Scrapling</span>
          </a>

          <nav class="main-nav" aria-label="Primary Navigation">
            <a
              routerLink="/"
              routerLinkActive="active-link"
              [routerLinkActiveOptions]="{ exact: true }"
              class="nav-item"
            >
              <mat-icon class="nav-icon">space_dashboard</mat-icon>
              <span>Overview</span>
            </a>

            <!-- Marketplaces Dropdown (Eneba & G2A) -->
            <button
              type="button"
              class="nav-item nav-dropdown-trigger"
              [class.active-link]="isMarketplaceRoute()"
              [matMenuTriggerFor]="marketplaceMenu"
            >
              <mat-icon class="nav-icon">storefront</mat-icon>
              <span>{{ activeMarketplaceLabel() }}</span>
              <mat-icon class="caret-icon">expand_more</mat-icon>
            </button>
            <mat-menu #marketplaceMenu="matMenu" class="clean-menu">
              <a
                mat-menu-item
                routerLink="/eneba"
                routerLinkActive="active-menu-item"
              >
                <mat-icon>local_offer</mat-icon>
                <div class="menu-item-col">
                  <span class="menu-item-title">Eneba</span>
                  <span class="menu-item-sub">Gift card deals &amp; analytics</span>
                </div>
              </a>
              <a
                mat-menu-item
                routerLink="/g2a"
                routerLinkActive="active-menu-item"
              >
                <mat-icon>sports_esports</mat-icon>
                <div class="menu-item-col">
                  <span class="menu-item-title">G2A</span>
                  <span class="menu-item-sub">Marketplace codes &amp; offers</span>
                </div>
              </a>
            </mat-menu>

            <a
              routerLink="/automation"
              routerLinkActive="active-link"
              class="nav-item"
            >
              <mat-icon class="nav-icon">schedule</mat-icon>
              <span>Automation</span>
            </a>

            <a
              routerLink="/settings"
              routerLinkActive="active-link"
              class="nav-item"
            >
              <mat-icon class="nav-icon">tune</mat-icon>
              <span>Settings</span>
            </a>
          </nav>
        </div>

        <!-- Right Status & Theme Controls -->
        <div class="header-right">
          <div
            class="runner-status-pill"
            [class.is-running]="apiService.dashboardData()?.runner?.isScraping"
          >
            <span class="status-dot"></span>
            <span class="status-text">
              {{ apiService.dashboardData()?.runner?.isScraping ? 'Scraping...' : 'Idle' }}
            </span>
          </div>

          <button
            mat-icon-button
            [matMenuTriggerFor]="themeMenu"
            class="theme-btn"
            [matTooltip]="'Theme: ' + getThemeLabel()"
            aria-label="Switch color theme"
          >
            <mat-icon>{{ getThemeIcon() }}</mat-icon>
          </button>
          <mat-menu #themeMenu="matMenu" class="clean-menu">
            <button
              mat-menu-item
              (click)="setTheme('light')"
              [class.active-menu-item]="themeService.themeMode() === 'light'"
            >
              <mat-icon>light_mode</mat-icon>
              <span>Light</span>
            </button>
            <button
              mat-menu-item
              (click)="setTheme('dark')"
              [class.active-menu-item]="themeService.themeMode() === 'dark'"
            >
              <mat-icon>dark_mode</mat-icon>
              <span>Dark</span>
            </button>
            <button
              mat-menu-item
              (click)="setTheme('system')"
              [class.active-menu-item]="themeService.themeMode() === 'system'"
            >
              <mat-icon>contrast</mat-icon>
              <span>System</span>
            </button>
          </mat-menu>
        </div>
      </div>
    </header>
  `,
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  constructor(
    public apiService: ApiService,
    public themeService: ThemeService,
    private router: Router,
  ) {}

  isMarketplaceRoute(): boolean {
    const url = this.router.url.split('?')[0].toLowerCase();
    return (
      url === '/eneba' ||
      url === '/g2a' ||
      url.startsWith('/provider/')
    );
  }

  activeMarketplaceLabel(): string {
    const url = this.router.url.split('?')[0].toLowerCase();
    if (url === '/eneba' || url === '/provider/eneba') return 'Marketplaces · Eneba';
    if (url === '/g2a' || url === '/provider/g2a') return 'Marketplaces · G2A';
    return 'Marketplaces';
  }

  getThemeIcon(): string {
    const mode = this.themeService.themeMode();
    if (mode === 'light') return 'light_mode';
    if (mode === 'dark') return 'dark_mode';
    return 'contrast';
  }

  getThemeLabel(): string {
    const mode = this.themeService.themeMode();
    if (mode === 'light') return 'Light';
    if (mode === 'dark') return 'Dark';
    return 'System';
  }

  setTheme(mode: ThemeMode): void {
    this.themeService.setTheme(mode);
  }
}
