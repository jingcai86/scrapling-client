import { Injectable, Inject, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { ThemeMode } from '../models/dashboard.model';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  readonly themeMode = signal<ThemeMode>('system');
  readonly isDark = signal<boolean>(false);
  private mediaQuery?: MediaQueryList;

  constructor(@Inject(PLATFORM_ID) private platformId: object) {
    if (isPlatformBrowser(this.platformId)) {
      const stored = localStorage.getItem('theme') as ThemeMode | null;
      const initialMode = stored === 'light' || stored === 'dark' ? stored : 'system';
      this.themeMode.set(initialMode);

      if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
        this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        this.mediaQuery.addEventListener?.('change', () => {
          if (this.themeMode() === 'system') {
            this.applyTheme('system');
          }
        });
      }

      this.applyTheme(initialMode);
    }
  }

  setTheme(mode: ThemeMode): void {
    this.themeMode.set(mode);
    if (isPlatformBrowser(this.platformId)) {
      if (mode === 'system') {
        localStorage.removeItem('theme');
      } else {
        localStorage.setItem('theme', mode);
      }
      this.applyTheme(mode);
    }
  }

  private applyTheme(mode: ThemeMode): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const systemDark = this.mediaQuery?.matches ?? false;
    const dark = mode === 'dark' || (mode === 'system' && systemDark);
    this.isDark.set(dark);

    const doc = document.documentElement;
    const meta = document.querySelector('meta[name="color-scheme"]') as HTMLMetaElement | null;

    if (mode === 'dark') {
      doc.setAttribute('data-theme', 'dark');
      doc.classList.add('dark-theme');
      if (meta) meta.content = 'dark';
    } else if (mode === 'light') {
      doc.setAttribute('data-theme', 'light');
      doc.classList.remove('dark-theme');
      if (meta) meta.content = 'light';
    } else {
      doc.removeAttribute('data-theme');
      doc.classList.toggle('dark-theme', systemDark);
      if (meta) meta.content = 'light dark';
    }
  }
}
