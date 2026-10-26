import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ConfigDialogComponent } from '../../dialogs/config-dialog.component';

@Component({
  selector: 'app-config',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
  ],
  template: `
    <div class="page-container">
      <mat-card class="modal-launcher-card" appearance="outlined">
        <mat-card-header>
          <div class="card-header-icon" mat-card-avatar>
            <mat-icon class="icon">settings</mat-icon>
          </div>
          <mat-card-title>System & Application Configuration</mat-card-title>
          <mat-card-subtitle>
            All configuration (color theme, database settings, and boot variables) is now presented in a modal dialog.
          </mat-card-subtitle>
        </mat-card-header>
        <mat-card-content class="launcher-content">
          <p>
            Click the button below (or use the <strong>⚙️ Configuration</strong> button in the navigation header) to open the configuration modal at any time.
          </p>
          <button mat-flat-button color="primary" class="launch-btn" (click)="openModal()">
            <mat-icon>open_in_new</mat-icon>
            <span>Open Configuration Modal</span>
          </button>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .page-container {
      max-width: 800px;
      margin: 2rem auto;
      padding: 0 1rem;
    }
    .modal-launcher-card {
      background: var(--mat-sys-surface-container);
      border-radius: 14px;
      padding: 1.5rem;
    }
    .card-header-icon {
      margin-right: 1rem;
      .icon {
        font-size: 2.25rem;
        color: var(--mat-sys-primary);
      }
    }
    .launcher-content {
      margin-top: 1.25rem;
      p {
        color: var(--mat-sys-on-surface-variant);
        font-size: 0.95rem;
        line-height: 1.5;
        margin-bottom: 1.25rem;
      }
    }
    .launch-btn {
      display: inline-flex !important;
      align-items: center !important;
      gap: 0.5rem !important;
      padding: 0.6rem 1.5rem !important;
      border-radius: 20px !important;
      font-weight: 600 !important;
    }
  `],
})
export class ConfigComponent implements OnInit {
  constructor(
    private dialog: MatDialog,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: object,
  ) {}

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.openModal();
    }
  }

  openModal() {
    if (this.dialog.openDialogs.some((d) => d.componentInstance instanceof ConfigDialogComponent)) {
      return;
    }
    const dialogRef = this.dialog.open(ConfigDialogComponent, {
      width: '1050px',
      maxWidth: '96vw',
      maxHeight: '92vh',
      autoFocus: false,
    });

    dialogRef.afterClosed().subscribe(() => {
      if (this.router.url === '/config') {
        this.router.navigate(['/']);
      }
    });
  }
}
