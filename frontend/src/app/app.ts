import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { HeaderComponent } from './components/header/header.component';
import { ScrapeBannerComponent } from './components/scrape-banner/scrape-banner.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterModule, HeaderComponent, ScrapeBannerComponent],
  template: `
    <app-header></app-header>
    <main class="main-content">
      <app-scrape-banner></app-scrape-banner>
      <router-outlet></router-outlet>
    </main>
  `,
  styles: [`
    .main-content {
      max-width: 1400px;
      margin: 0 auto;
      padding: 1.5rem;
    }
  `],
})
export class App {}
