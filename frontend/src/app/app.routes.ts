import { Routes } from '@angular/router';
import { OverviewComponent } from './pages/overview/overview.component';
import { MarketplaceComponent } from './pages/marketplace/marketplace.component';
import { AutomationComponent } from './pages/automation/automation.component';
import { SettingsComponent } from './pages/settings/settings.component';

export const routes: Routes = [
  { path: '', component: OverviewComponent },
  { path: 'eneba', component: MarketplaceComponent },
  { path: 'g2a', component: MarketplaceComponent },
  { path: 'provider/:provider', component: MarketplaceComponent },
  { path: 'automation', component: AutomationComponent },
  { path: 'schedulers', component: AutomationComponent },
  { path: 'scraping', component: AutomationComponent },
  { path: 'settings', component: SettingsComponent },
  { path: 'config', component: SettingsComponent },
  { path: '**', redirectTo: '' },
];
