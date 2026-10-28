import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { ProviderComponent } from './pages/provider/provider.component';
import { ScrapingComponent } from './pages/scraping/scraping.component';
import { ConfigComponent } from './pages/config/config.component';

export const routes: Routes = [
  { path: '', component: HomeComponent, pathMatch: 'full' },
  { path: 'eneba', component: ProviderComponent },
  { path: 'g2a', component: ProviderComponent },
  { path: 'provider/:provider', component: ProviderComponent },
  { path: 'schedulers', component: ScrapingComponent },
  { path: 'scheduler', redirectTo: 'schedulers' },
  { path: 'scraping', redirectTo: 'schedulers' },
  { path: 'config', component: ConfigComponent },
  { path: '**', redirectTo: '' },
];
