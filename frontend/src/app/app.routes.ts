import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { EnebaComponent } from './pages/eneba/eneba.component';
import { ScrapingComponent } from './pages/scraping/scraping.component';
import { ConfigComponent } from './pages/config/config.component';

export const routes: Routes = [
  { path: '', component: HomeComponent, pathMatch: 'full' },
  { path: 'eneba', component: EnebaComponent },
  { path: 'g2a', component: EnebaComponent },
  { path: 'provider/:provider', component: EnebaComponent },
  { path: 'schedulers', component: ScrapingComponent },
  { path: 'scheduler', redirectTo: 'schedulers' },
  { path: 'scraping', redirectTo: 'schedulers' },
  { path: 'config', component: ConfigComponent },
  { path: '**', redirectTo: '' },
];
