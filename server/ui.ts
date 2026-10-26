export function renderDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Scrapling Monitor — Home, Eneba, Scraping & Configuration</title>
  <style>
    :root {
      --bg: #0f172a;
      --bg-panel: #1e293b;
      --bg-panel-alt: #0f172a;
      --bg-hover: #334155;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --border: #334155;
      --primary: #6366f1;
      --primary-hover: #4f46e5;
      --success: #10b981;
      --success-bg: rgba(16, 185, 129, 0.14);
      --warning: #f59e0b;
      --warning-bg: rgba(245, 158, 11, 0.14);
      --danger: #ef4444;
      --danger-bg: rgba(239, 68, 68, 0.15);
      --radius: 12px;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
    }

    a {
      color: #818cf8;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }

    .app-header {
      background: rgba(30, 41, 59, 0.92);
      backdrop-filter: blur(8px);
      border-block-end: 1px solid var(--border);
      position: sticky;
      inset-block-start: 0;
      z-index: 20;
      padding: 0.9rem 1.5rem;
    }

    .header-inner {
      max-width: 1400px;
      margin: 0 auto;
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      align-items: center;
      justify-content: space-between;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .brand-badge {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: linear-gradient(135deg, #6366f1, #10b981);
      display: grid;
      place-items: center;
      font-weight: 800;
      font-size: 1.1rem;
      color: #fff;
    }

    .brand h1 {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 700;
    }

    .brand p {
      margin: 0;
      font-size: 0.78rem;
      color: var(--text-muted);
    }

    .nav-tabs {
      display: flex;
      gap: 0.35rem;
      flex-wrap: wrap;
      background: var(--bg-panel-alt);
      padding: 0.3rem;
      border-radius: 10px;
      border: 1px solid var(--border);
    }

    .tab-btn {
      background: transparent;
      color: var(--text-muted);
      border: none;
      padding: 0.5rem 0.95rem;
      border-radius: 7px;
      font-size: 0.86rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .tab-btn:hover {
      color: var(--text);
      background: rgba(255, 255, 255, 0.05);
    }

    .tab-btn.active {
      color: #fff;
      background: var(--primary);
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.5rem 0.95rem;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 600;
      border: 1px solid var(--border);
      background: var(--bg-panel);
      color: var(--text);
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .btn:hover:not(:disabled) {
      background: var(--bg-hover);
    }

    .btn:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .btn-primary {
      background: var(--primary);
      border-color: var(--primary);
      color: #fff;
    }

    .btn-primary:hover:not(:disabled) {
      background: var(--primary-hover);
    }

    .btn-success {
      background: #059669;
      border-color: #059669;
      color: #fff;
    }

    .btn-danger {
      background: var(--danger-bg);
      border-color: rgba(239, 68, 68, 0.4);
      color: #fca5a5;
    }

    .btn-sm {
      padding: 0.3rem 0.65rem;
      font-size: 0.78rem;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 1.5rem;
    }

    /* Live Scrape Progress Banner */
    .scrape-banner {
      background: linear-gradient(90deg, rgba(99, 102, 241, 0.18), rgba(16, 185, 129, 0.15));
      border: 1px solid rgba(99, 102, 241, 0.45);
      border-radius: var(--radius);
      padding: 0.9rem 1.25rem;
      margin-block-end: 1.5rem;
      display: none;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }

    .scrape-banner.active {
      display: flex;
    }

    .spinner {
      width: 18px;
      height: 18px;
      border: 2.5px solid rgba(255, 255, 255, 0.25);
      border-top-color: #818cf8;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      flex-shrink: 0;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* KPI Grid */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1rem;
      margin-block-end: 1.5rem;
    }

    .kpi-card {
      background: var(--bg-panel);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 1.1rem 1.25rem;
    }

    .kpi-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      font-weight: 600;
    }

    .kpi-value {
      font-size: 1.55rem;
      font-weight: 800;
      margin: 0.25rem 0;
    }

    .kpi-sub {
      font-size: 0.8rem;
      color: var(--text-muted);
    }

    .card {
      background: var(--bg-panel);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 1.25rem;
      margin-block-end: 1.5rem;
    }

    .card-header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      margin-block-end: 1rem;
    }

    .card-title {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 700;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      padding: 0.2rem 0.6rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 700;
    }

    .badge-provider {
      background: rgba(99, 102, 241, 0.2);
      color: #a5b4fc;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .badge-discount {
      background: var(--success-bg);
      color: #34d399;
    }

    .badge-alert {
      background: var(--warning-bg);
      color: #fbbf24;
    }

    .badge-muted {
      background: rgba(148, 163, 184, 0.15);
      color: var(--text-muted);
    }

    /* Modern Responsive & Sortable Table (modern-web-guidance: responsive-table) */
    .table-wrapper {
      overflow: auto;
      max-inline-size: 100%;
      max-block-size: min(640px, 80vh);
      container-type: inline-size;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--bg-panel-alt);
    }

    table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      text-align: left;
      font-size: 0.875rem;
    }

    caption {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    thead {
      position: sticky;
      inset-block-start: 0;
      z-index: 1;
      background: #1e293b;
    }

    th, td {
      padding: 0.72rem 0.95rem;
      border-block-end: 1px solid var(--border);
      vertical-align: middle;
    }

    thead th {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      font-weight: 700;
      background: #1e293b;
      user-select: none;
      white-space: nowrap;
    }

    thead th.sortable {
      cursor: pointer;
      transition: color 0.15s ease, background 0.15s ease;
    }

    thead th.sortable:hover {
      color: var(--text);
      background: #273549;
    }

    thead th.sortable[aria-sort="ascending"],
    thead th.sortable[aria-sort="descending"] {
      color: #a5b4fc;
      background: rgba(99, 102, 241, 0.15);
    }

    .sort-icon {
      display: inline-block;
      margin-inline-start: 0.35rem;
      font-size: 0.72rem;
      opacity: 0.75;
    }

    tbody th {
      position: sticky;
      inset-inline-start: 0;
      background: var(--bg-panel-alt);
      font-weight: 600;
      color: var(--text);
    }

    tbody tr:hover td,
    tbody tr:hover th {
      background: rgba(51, 65, 85, 0.45);
    }

    @container (width < 600px) {
      table, thead, tbody, tr, th, td {
        display: block;
      }

      thead {
        display: none;
      }

      tr {
        margin-block-end: 1rem;
        border: 1px solid var(--border);
        border-radius: 8px;
        overflow: hidden;
      }

      tbody th {
        position: sticky;
        inset-block-start: 0;
        z-index: 2;
        background: #1e293b;
      }

      td:nth-child(2)::before {
        content: var(--label-2) ": ";
        font-weight: 600;
        color: var(--text-muted);
      }
      td:nth-child(3)::before {
        content: var(--label-3) ": ";
        font-weight: 600;
        color: var(--text-muted);
      }
      td:nth-child(4)::before {
        content: var(--label-4) ": ";
        font-weight: 600;
        color: var(--text-muted);
      }
      td:nth-child(5)::before {
        content: var(--label-5) ": ";
        font-weight: 600;
        color: var(--text-muted);
      }
      td:nth-child(6)::before {
        content: var(--label-6) ": ";
        font-weight: 600;
        color: var(--text-muted);
      }
      td:nth-child(7)::before {
        content: var(--label-7) ": ";
        font-weight: 600;
        color: var(--text-muted);
      }
      td:nth-child(8)::before {
        content: var(--label-8) ": ";
        font-weight: 600;
        color: var(--text-muted);
      }
    }

    /* Form Controls & Deferred Validation (:user-invalid from modern-web-guidance) */
    .form-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(270px, 1fr));
      gap: 1rem;
    }

    .field {
      display: flex;
      flex-direction: column;
      margin-block-end: 0.75rem;
    }

    .field label {
      font-size: 0.84rem;
      font-weight: 600;
      color: var(--text);
      margin-block-end: 0.15rem;
    }

    .hint {
      display: block;
      color: var(--text-muted);
      font-size: 0.75rem;
      margin-block-end: 0.35rem;
    }

    input[type="text"],
    input[type="url"],
    input[type="email"],
    input[type="number"],
    input[type="time"],
    input[type="password"],
    input[type="search"],
    select {
      padding: 0.52rem 0.75rem;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--bg-panel-alt);
      color: var(--text);
      font-size: 0.875rem;
      outline: none;
    }

    input:focus, select:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.25);
    }

    .error-msg {
      display: none;
      color: #fca5a5;
      font-size: 0.8rem;
      margin-block-start: 0.3rem;
    }

    input:user-invalid,
    input.user-invalid-fallback {
      border-color: #ef4444;
      background-color: rgba(239, 68, 68, 0.12);
    }

    input:user-invalid + .error-msg,
    input.user-invalid-fallback + .error-msg {
      display: block;
    }

    input:user-valid {
      border-color: #10b981;
    }

    .tab-panel {
      display: none;
    }

    .tab-panel.active {
      display: block;
    }

    .kv-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 0.85rem;
    }

    .kv-box {
      background: var(--bg-panel-alt);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 0.85rem 1rem;
    }

    .kv-label {
      font-size: 0.75rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .kv-val {
      font-size: 1rem;
      font-weight: 700;
      margin-top: 0.2rem;
    }

    /* Native Light-Dismiss Dialogs (modern-web-guidance: light-dismiss-a-dialog) */
    dialog {
      background: var(--bg-panel);
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 0;
      max-width: min(860px, 94vw);
      width: 100%;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
    }

    dialog::backdrop {
      background-color: rgba(0, 0, 0, 0.65);
      backdrop-filter: blur(3px);
    }

    .dialog-inner {
      padding: 1.25rem 1.5rem;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-block-end: 1px solid var(--border);
      padding-block-end: 0.85rem;
      margin-block-end: 1rem;
    }

    .log-box {
      background: #090d16;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 0.75rem 1rem;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.78rem;
      color: #cbd5e1;
      max-height: 200px;
      overflow-y: auto;
    }

    .toast {
      position: fixed;
      inset-block-end: 1.25rem;
      inset-inline-end: 1.25rem;
      background: #1e293b;
      border: 1px solid var(--primary);
      color: #fff;
      padding: 0.75rem 1.1rem;
      border-radius: 10px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.45);
      z-index: 100;
      display: none;
      font-size: 0.85rem;
      font-weight: 600;
    }

    .toast.show {
      display: block;
    }
  </style>
</head>
<body>
  <header class="app-header">
    <div class="header-inner">
      <div class="brand">
        <div class="brand-badge">S</div>
        <div>
          <h1>Scrapling Monitor</h1>
          <p>Multi-Provider Scraper • Randomized Cron • Resend Alerts</p>
        </div>
      </div>

      <nav class="nav-tabs" aria-label="Main Navigation">
        <button type="button" class="tab-btn active" data-tab="home" data-route="/">🏠 Home</button>
        <button type="button" class="tab-btn" data-tab="eneba" data-route="/eneba">🎮 Eneba Deals</button>
        <button type="button" class="tab-btn" data-tab="scraping" data-route="/scraping">⚡ Scraping &amp; Targets (<span id="navPagesCount">0</span>)</button>
        <button type="button" class="tab-btn" data-tab="config" data-route="/config">⚙️ Configuration</button>
      </nav>
    </div>
  </header>

  <main class="container">
    <!-- Global Live Scrape Progress Banner -->
    <div id="scrapeBanner" class="scrape-banner" role="status" aria-live="polite">
      <div style="display:flex;align-items:center;gap:0.85rem;">
        <div class="spinner"></div>
        <div>
          <div style="font-weight:700;font-size:0.92rem;" id="scrapeStepText">Scraping in progress...</div>
          <div style="font-size:0.8rem;color:var(--text-muted);" id="scrapeProgressSub">Connecting to Scrapling MCP...</div>
        </div>
      </div>
      <span class="badge badge-provider" id="scrapeProgressBadge">0 / 0</span>
    </div>

    <!-- =================================================================== -->
    <!-- PAGE 1: HOME (MONITORED PROVIDERS & SYSTEM STATUS)                  -->
    <!-- =================================================================== -->
    <section id="tab-home" class="tab-panel active">
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-label">Monitored Providers</div>
          <div class="kpi-value" id="kpiProvidersCount">—</div>
          <div class="kpi-sub" id="kpiPagesSub">0 active scrape pages</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Last Scraped</div>
          <div class="kpi-value" style="font-size:1.2rem;" id="kpiLastScrapedTime">—</div>
          <div class="kpi-sub" id="kpiLastScrapedSub">Provider: eneba</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Next Scheduled Scrape</div>
          <div class="kpi-value" style="font-size:1.25rem;" id="kpiNextCron">—</div>
          <div class="kpi-sub" id="kpiCronWindow">Base 19:00 + 0..60m random jitter</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Engine &amp; Storage Status</div>
          <div class="kpi-value" style="font-size:1.25rem;" id="kpiAlertThreshold">Active</div>
          <div class="kpi-sub" id="kpiDbStatus">PostgreSQL (scrapling schema)</div>
        </div>
      </div>

      <!-- Home Table: Providers Overview (Provider-Agnostic, No Deals) -->
      <div class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Monitored Store Providers</h2>
            <div style="font-size:0.8rem;color:var(--text-muted);">
              Overview of configured store providers and when they were last scraped. All scraped deals are located within their dedicated store tab.
            </div>
          </div>
        </div>

        <div tabindex="0" role="region" aria-labelledby="providers-table-caption" class="table-wrapper">
          <table id="providersTable" style="--label-2:'Tracked Pages';--label-3:'Status';--label-4:'Last Scraped';--label-5:'Store Deals';">
            <caption id="providers-table-caption">Summary of monitored store providers and last scrape timestamps</caption>
            <thead>
              <tr>
                <th class="sortable" data-table="providers" data-sort-key="provider" aria-sort="ascending">Provider <span class="sort-icon">↑</span></th>
                <th class="sortable" data-table="providers" data-sort-key="activePages" aria-sort="none">Tracked Pages <span class="sort-icon">↕</span></th>
                <th class="sortable" data-table="providers" data-sort-key="status" aria-sort="none">Status <span class="sort-icon">↕</span></th>
                <th class="sortable" data-table="providers" data-sort-key="lastScraped" aria-sort="none">Last Scraped <span class="sort-icon">↕</span></th>
                <th>Store Deals</th>
              </tr>
            </thead>
            <tbody id="providersTableBody">
              <tr><td colspan="5" style="color:var(--text-muted);text-align:center;">Loading providers...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- =================================================================== -->
    <!-- PAGE 2: DEDICATED ENEBA PAGE (/eneba)                               -->
    <!-- =================================================================== -->
    <section id="tab-eneba" class="tab-panel">
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-label">Eneba Store Categories</div>
          <div class="kpi-value" id="enebaKpiCategories">—</div>
          <div class="kpi-sub">PlayStation, Nintendo, Android, Amazon, Apple</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Eneba Cards In Stock</div>
          <div class="kpi-value" id="enebaKpiInStock">—</div>
          <div class="kpi-sub" id="enebaKpiDiscounted">0 with direct discount</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Best Eneba Effective Deal (+CB)</div>
          <div class="kpi-value" style="color:#34d399;" id="enebaKpiBestPct">—</div>
          <div class="kpi-sub" id="enebaKpiBestTitle">—</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Competing Seller Offers</div>
          <div class="kpi-value" id="enebaKpiOffersCount">—</div>
          <div class="kpi-sub">Third-party vendor offers on #1 deals</div>
        </div>
      </div>

      <!-- Eneba Provider Configuration (scrapling.eneba_config) -->
      <div class="card" style="margin-block-end:1.25rem;">
        <div class="card-header" style="flex-wrap:wrap;gap:1rem;">
          <div>
            <h2 class="card-title" style="display:flex;align-items:center;gap:0.5rem;">
              <span>⚙️ Eneba Scraper &amp; Alert Configuration</span>
              <span class="badge badge-discount" style="font-size:0.75rem;">scrapling.eneba_config</span>
            </h2>
            <div style="font-size:0.8rem;color:var(--text-muted);">
              Configure how many top deals to pull per category and the minimum discount % to trigger email alerts. Stored in PostgreSQL <code>scrapling.eneba_config</code>.
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:0.85rem;flex-wrap:wrap;">
            <div style="display:flex;align-items:center;gap:0.4rem;">
              <label for="enebaTopDealsLimitInput" style="font-size:0.83rem;font-weight:600;color:var(--text);">
                Pull Limit:
              </label>
              <input
                type="number"
                id="enebaTopDealsLimitInput"
                min="1"
                max="50"
                step="1"
                value="10"
                style="width:72px;padding:0.35rem 0.5rem;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-weight:700;text-align:center;"
                aria-label="Number of top deals to pull per category"
              />
            </div>
            <div style="display:flex;align-items:center;gap:0.4rem;">
              <label for="enebaAlertThresholdInput" style="font-size:0.83rem;font-weight:600;color:var(--text);">
                Alert Threshold (%):
              </label>
              <input
                type="number"
                id="enebaAlertThresholdInput"
                min="0"
                max="100"
                step="1"
                value="20"
                style="width:72px;padding:0.35rem 0.5rem;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-weight:700;text-align:center;"
                aria-label="Minimum discount percent to trigger alert email"
              />
            </div>
            <button type="button" class="btn btn-sm btn-primary" id="btnSaveEnebaConfig">
              Save Configuration
            </button>
            <button type="button" class="btn btn-sm" onclick="triggerScrape({})">
              ▶ Scrape Now
            </button>
          </div>
        </div>
      </div>

      <!-- Eneba Table 1: Category Status, Cashback & Competing Seller Offers (Sortable) -->
      <div class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Eneba Gift Card Categories — Status, Cashback &amp; Seller Offers</h2>
            <div style="font-size:0.8rem;color:var(--text-muted);">
              Eneba-specific metrics including Plus/Cashback effective discounts and competing third-party merchant offers. Click any header to sort.
            </div>
          </div>
          <div style="display:flex;gap:0.5rem;">
            <button type="button" class="btn btn-sm btn-primary" onclick="triggerScrape({})">▶ Scrape Eneba Pages</button>
          </div>
        </div>

        <div tabindex="0" role="region" aria-labelledby="eneba-summary-caption" class="table-wrapper">
          <table id="enebaSummaryTable" style="--label-2:'In Stock';--label-3:'Avg Direct Disc';--label-4:'Avg Effective (+CB)';--label-5:'#1 Best Deal on Page';--label-6:'Competing Sellers';--label-7:'Last Scraped';">
            <caption id="eneba-summary-caption">Eneba category status and competing seller offers</caption>
            <thead>
              <tr>
                <th class="sortable" data-table="enebaSummary" data-sort-key="category" aria-sort="none">Eneba Category <span class="sort-icon">↕</span></th>
                <th class="sortable" data-table="enebaSummary" data-sort-key="inStockCount" aria-sort="none">In Stock <span class="sort-icon">↕</span></th>
                <th class="sortable" data-table="enebaSummary" data-sort-key="avgDirect" aria-sort="none">Avg Direct Disc <span class="sort-icon">↕</span></th>
                <th class="sortable" data-table="enebaSummary" data-sort-key="avgEffective" aria-sort="descending">Avg Effective (+CB) <span class="sort-icon">↓</span></th>
                <th class="sortable" data-table="enebaSummary" data-sort-key="bestEffective" aria-sort="none">#1 Best Deal on Page <span class="sort-icon">↕</span></th>
                <th class="sortable" data-table="enebaSummary" data-sort-key="offersCount" aria-sort="none">Competing Sellers <span class="sort-icon">↕</span></th>
                <th class="sortable" data-table="enebaSummary" data-sort-key="scrapedAt" aria-sort="none">Last Scraped <span class="sort-icon">↕</span></th>
              </tr>
            </thead>
            <tbody id="enebaSummaryBody">
              <tr><td colspan="7" style="color:var(--text-muted);text-align:center;">Loading Eneba categories...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Eneba Table 2: Eneba Top Ranked Deals Per Category (Sortable) -->
      <div class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Eneba Top <span id="enebaPullLimitBadge">10</span> Ranked Gift Card Deals</h2>
            <div style="font-size:0.8rem;color:var(--text-muted);">
              Includes region, face value baseline, direct discount %, and Eneba cashback %. Click any column header to sort.
            </div>
          </div>
          <div style="display:flex;gap:0.6rem;align-items:center;flex-wrap:wrap;">
            <input type="search" id="enebaSearchInput" placeholder="Filter Eneba cards (e.g. PSN 100)..." style="min-width:210px;" aria-label="Search Eneba deals" />
            <select id="enebaCategoryFilter" aria-label="Filter by Eneba category">
              <option value="all">All Eneba Categories</option>
            </select>
          </div>
        </div>

        <div tabindex="0" role="region" aria-labelledby="eneba-deals-caption" class="table-wrapper">
          <table id="enebaDealsTable" style="--label-2:'Product Title';--label-3:'Category';--label-4:'Region';--label-5:'Selling Price';--label-6:'Direct Disc';--label-7:'Effective (+CB)';--label-8:'Scraped At';--label-9:'Action';">
            <caption id="eneba-deals-caption">Eneba top 10 ranked gift card deals</caption>
            <thead>
              <tr>
                <th class="sortable" data-table="enebaDeals" data-sort-key="rank" aria-sort="none">Rank <span class="sort-icon">↕</span></th>
                <th class="sortable" data-table="enebaDeals" data-sort-key="title" aria-sort="none">Product Title <span class="sort-icon">↕</span></th>
                <th class="sortable" data-table="enebaDeals" data-sort-key="category" aria-sort="none">Category <span class="sort-icon">↕</span></th>
                <th class="sortable" data-table="enebaDeals" data-sort-key="region" aria-sort="none">Region <span class="sort-icon">↕</span></th>
                <th class="sortable" data-table="enebaDeals" data-sort-key="sellingPrice" aria-sort="none">Selling Price <span class="sort-icon">↕</span></th>
                <th class="sortable" data-table="enebaDeals" data-sort-key="discountPct" aria-sort="none">Direct Disc <span class="sort-icon">↕</span></th>
                <th class="sortable" data-table="enebaDeals" data-sort-key="effectiveDiscountPct" aria-sort="descending">Effective (+CB) <span class="sort-icon">↓</span></th>
                <th class="sortable" data-table="enebaDeals" data-sort-key="scrapedAt" aria-sort="none">Scraped At <span class="sort-icon">↕</span></th>
                <th>Eneba Link</th>
              </tr>
            </thead>
            <tbody id="enebaDealsBody">
              <tr><td colspan="9" style="color:var(--text-muted);text-align:center;">Loading Eneba deals...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- =================================================================== -->
    <!-- PAGE 3: SCRAPING & TARGETS (ALL SCRAPING ACTIONS, SCHEDULE & PAGES) -->
    <!-- =================================================================== -->
    <section id="tab-scraping" class="tab-panel">
      <!-- 1. Scraping Actions & Live Console -->
      <div class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Scraping Actions &amp; Live Execution Console</h2>
            <div style="font-size:0.8rem;color:var(--text-muted);">
              Trigger an immediate scrape across all enabled pages or run a fast listing-only check.
            </div>
          </div>
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
            <button type="button" class="btn btn-primary" id="btnScrapeAll">
              <span>▶ Scrape All Enabled (With Offers)</span>
            </button>
            <button type="button" class="btn" id="btnScrapeFast">
              <span>⚡ Fast Scrape All (Listing Only)</span>
            </button>
          </div>
        </div>
        <div class="log-box" id="logBox">Ready. Waiting for scrape actions.</div>
      </div>

      <!-- 2. Randomized Daily Cron Schedule (Clean View Mode vs Edit Modal) -->
      <div class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Daily Randomized Cron Schedule</h2>
            <div style="font-size:0.8rem;color:var(--text-muted);">
              Runs daily at <code>CRON_BASE_TIME</code> plus a random delay (0 to <code>CRON_JITTER_MINUTES</code>), e.g., 7:00 PM to 8:00 PM.
            </div>
          </div>
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
            <button type="button" class="btn btn-sm" id="btnRerollCron">🎲 Re-Roll Random Time</button>
            <button type="button" class="btn btn-sm btn-primary" id="btnOpenCronDialog">✎ Edit Schedule</button>
          </div>
        </div>

        <div class="kv-grid">
          <div class="kv-box">
            <div class="kv-label">Scheduler Status</div>
            <div class="kv-val" id="viewCronEnabled">—</div>
          </div>
          <div class="kv-box">
            <div class="kv-label">Daily Window</div>
            <div class="kv-val" id="viewCronWindow">—</div>
          </div>
          <div class="kv-box">
            <div class="kv-label">Rolled Random Offset</div>
            <div class="kv-val" id="viewCronOffset">—</div>
          </div>
          <div class="kv-box">
            <div class="kv-label">Next Scheduled Run</div>
            <div class="kv-val" style="color:#818cf8;" id="viewCronNext">—</div>
          </div>
          <div class="kv-box">
            <div class="kv-label">Last Scheduled Run</div>
            <div class="kv-val" style="font-size:0.9rem;" id="viewCronLast">—</div>
          </div>
        </div>
      </div>

      <!-- 3. Target Scraping Pages Table (Sortable + Add/Edit Modal) -->
      <div class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Target Scraping Pages</h2>
            <div style="font-size:0.8rem;color:var(--text-muted);">
              Click any column header to sort. Manage store URLs across providers or trigger a single-page scrape.
            </div>
          </div>
          <button type="button" class="btn btn-primary" id="btnOpenAddPageDialog">+ Add Scraping Page</button>
        </div>

        <div tabindex="0" role="region" aria-labelledby="pages-table-caption" class="table-wrapper">
          <table id="pagesTable" style="--label-2:'Provider';--label-3:'Store URL';--label-4:'Seller Offers';--label-5:'Status';--label-6:'Actions';">
            <caption id="pages-table-caption">Configured scraping pages</caption>
            <thead>
              <tr>
                <th class="sortable" data-table="pages" data-sort-key="categoryName" aria-sort="ascending">Category Name <span class="sort-icon">↑</span></th>
                <th class="sortable" data-table="pages" data-sort-key="provider" aria-sort="none">Provider <span class="sort-icon">↕</span></th>
                <th class="sortable" data-table="pages" data-sort-key="url" aria-sort="none">Store Page URL <span class="sort-icon">↕</span></th>
                <th class="sortable" data-table="pages" data-sort-key="withOffers" aria-sort="none">Seller Offers <span class="sort-icon">↕</span></th>
                <th class="sortable" data-table="pages" data-sort-key="enabled" aria-sort="none">Status <span class="sort-icon">↕</span></th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="pagesTableBody"></tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- =================================================================== -->
    <!-- PAGE 4: CONFIGURATION (ALL .ENV, DB, CRON & EMAIL IN ONE PLACE)     -->
    <!-- =================================================================== -->
    <section id="tab-config" class="tab-panel">
      <div class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">System &amp; Database Configuration (<code>scrapling.config</code> &amp; <code>.env</code>)</h2>
            <div style="font-size:0.8rem;color:var(--text-muted);">
              Boot variables (<code>PORT</code>, <code>DATABASE_URL</code>) live in <code id="envFilePathLabel">.env</code>; all runtime settings are stored in PostgreSQL table <code>scrapling.config</code>.
            </div>
          </div>
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
            <button type="button" class="btn btn-sm" id="btnToggleSecrets">👁 Show Secrets</button>
            <button type="button" class="btn btn-sm" id="btnPreviewEmailConfig">✉ Preview Alert Email</button>
            <button type="button" class="btn btn-sm btn-success" id="btnSendTestEmail">🚀 Send Test Email</button>
            <button type="button" class="btn btn-sm btn-primary" id="btnEnterConfigEdit">✎ Edit Configuration</button>
          </div>
        </div>

        <!-- VIEW MODE: Sortable Read-Only Configuration Table -->
        <div id="configViewMode">
          <div tabindex="0" role="region" aria-labelledby="config-table-caption" class="table-wrapper">
            <table id="configTable" style="--label-2:'Section';--label-3:'Storage';--label-4:'Current Value';--label-5:'Description';">
              <caption id="config-table-caption">Current configuration variables across .env and scrapling.config</caption>
              <thead>
                <tr>
                  <th class="sortable" data-table="config" data-sort-key="key" aria-sort="none">Variable Key <span class="sort-icon">↕</span></th>
                  <th class="sortable" data-table="config" data-sort-key="group" aria-sort="ascending">Section <span class="sort-icon">↑</span></th>
                  <th class="sortable" data-table="config" data-sort-key="storage" aria-sort="none">Storage <span class="sort-icon">↕</span></th>
                  <th class="sortable" data-table="config" data-sort-key="value" aria-sort="none">Current Value <span class="sort-icon">↕</span></th>
                  <th class="sortable" data-table="config" data-sort-key="description" aria-sort="none">Description <span class="sort-icon">↕</span></th>
                </tr>
              </thead>
              <tbody id="configTableBody"></tbody>
            </table>
          </div>
        </div>

        <!-- EDIT MODE: Sectioned Form Editor -->
        <div id="configEditMode" style="display:none;">
          <div style="display:flex;justify-content:space-between;align-items:center;background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.4);padding:0.75rem 1rem;border-radius:10px;margin-block-end:1rem;">
            <span style="font-size:0.85rem;font-weight:600;color:#a5b4fc;">Editing Configuration — Runtime settings save to PostgreSQL <code>scrapling.config</code> and apply immediately.</span>
            <div style="display:flex;gap:0.5rem;">
              <button type="button" class="btn btn-sm" id="btnCancelConfigEdit">Cancel</button>
              <button type="button" class="btn btn-sm btn-primary" id="btnSaveAllEnv">💾 Save Changes</button>
            </div>
          </div>

          <form id="envEditorForm">
            <div id="envFieldsContainer"></div>
          </form>

          <div style="margin-top:1.25rem;padding-top:1.25rem;border-top:1px solid var(--border);">
            <h3 style="margin:0 0 0.75rem;font-size:0.95rem;">Add Custom Configuration Variable (<code>scrapling.config</code>)</h3>
            <form id="addCustomEnvForm" style="display:flex;gap:0.75rem;flex-wrap:wrap;align-items:flex-end;">
              <div class="field" style="flex:1;min-width:220px;margin:0;">
                <label for="customEnvKey">Variable Name</label>
                <span id="customkey-hint" class="hint">Example: CUSTOM_PROXY_URL</span>
                <input type="text" id="customEnvKey" placeholder="CUSTOM_KEY" required aria-describedby="customkey-hint" />
              </div>
              <div class="field" style="flex:2;min-width:280px;margin:0;">
                <label for="customEnvVal">Value</label>
                <span id="customval-hint" class="hint">Value to store in scrapling.config</span>
                <input type="text" id="customEnvVal" placeholder="value" aria-describedby="customval-hint" />
              </div>
              <button type="submit" class="btn">+ Add Variable</button>
            </form>
          </div>
        </div>
      </div>
    </section>
  </main>

  <!-- ===================================================================== -->
  <!-- LIGHT-DISMISS DIALOGS (modern-web-guidance: light-dismiss-a-dialog)   -->
  <!-- ===================================================================== -->

  <!-- Dialog 1: Add / Edit Scraping Page -->
  <dialog id="pageFormDialog" closedby="any" aria-labelledby="pageFormDialogTitle">
    <div class="dialog-inner">
      <div class="dialog-header">
        <h3 id="pageFormDialogTitle" style="margin:0;font-size:1.05rem;">Add Scraping Page</h3>
        <form method="dialog">
          <button type="submit" class="btn btn-sm">✕ Close</button>
        </form>
      </div>
      <form id="pageModalForm">
        <input type="hidden" id="editPageId" value="" />
        <div class="field">
          <label for="newPageProvider">Provider</label>
          <span id="provider-hint" class="hint">Store provider identifier (e.g., eneba)</span>
          <input
            type="text"
            id="newPageProvider"
            name="provider"
            value="eneba"
            required
            aria-describedby="provider-hint"
            aria-errormessage="provider-err"
          />
          <div id="provider-err" class="error-msg">
            <span aria-hidden="true">❌</span> Provider is required.
          </div>
        </div>

        <div class="field">
          <label for="newPageCategory">Category Name</label>
          <span id="cat-hint" class="hint">Example: Xbox Gift Cards or Steam Gift Cards</span>
          <input
            type="text"
            id="newPageCategory"
            name="categoryName"
            placeholder="Xbox Gift Cards"
            required
            aria-describedby="cat-hint"
            aria-errormessage="cat-err"
          />
          <div id="cat-err" class="error-msg">
            <span aria-hidden="true">❌</span> Please enter a category title.
          </div>
        </div>

        <div class="field">
          <label for="newPageUrl">Category Store URL</label>
          <span id="url-hint" class="hint">Format: https://www.eneba.com/us/store/xbox-gift-cards</span>
          <input
            type="url"
            id="newPageUrl"
            name="url"
            placeholder="https://www.eneba.com/us/store/xbox-gift-cards"
            required
            aria-describedby="url-hint"
            aria-errormessage="url-err"
          />
          <div id="url-err" class="error-msg">
            <span aria-hidden="true">❌</span> Please enter a valid https:// URL.
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:0.6rem;margin:0.75rem 0 1.25rem;">
          <label style="display:inline-flex;align-items:center;gap:0.5rem;font-size:0.875rem;cursor:pointer;">
            <input type="checkbox" id="newPageWithOffers" checked />
            Scrape competing third-party seller offers (headless browser)
          </label>
          <label style="display:inline-flex;align-items:center;gap:0.5rem;font-size:0.875rem;cursor:pointer;">
            <input type="checkbox" id="newPageEnabled" checked />
            Page Enabled for Scheduled &amp; Batch Scrapes
          </label>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:0.5rem;">
          <button type="button" class="btn" onclick="document.getElementById('pageFormDialog').close()">Cancel</button>
          <button type="submit" class="btn btn-primary" id="btnSubmitPageModal">💾 Save Page</button>
        </div>
      </form>
    </div>
  </dialog>

  <!-- Dialog 2: Edit Randomized Daily Cron Schedule -->
  <dialog id="cronFormDialog" closedby="any" aria-labelledby="cronDialogTitle">
    <div class="dialog-inner">
      <div class="dialog-header">
        <h3 id="cronDialogTitle" style="margin:0;font-size:1.05rem;">Edit Randomized Daily Cron Schedule</h3>
        <form method="dialog">
          <button type="submit" class="btn btn-sm">✕ Close</button>
        </form>
      </div>
      <form id="schedulerForm">
        <div class="field">
          <label style="display:inline-flex;align-items:center;gap:0.5rem;cursor:pointer;">
            <input type="checkbox" id="cronEnabledInput" checked />
            Enable Daily Randomized Cron Job (<code>CRON_ENABLED</code>)
          </label>
        </div>

        <div class="field">
          <label for="cronBaseTimeInput">Daily Window Start Time (<code>CRON_BASE_TIME</code>)</label>
          <span id="basetime-hint" class="hint">24-hour time when the random window opens (19:00 = 7:00 PM)</span>
          <input
            type="time"
            id="cronBaseTimeInput"
            required
            value="19:00"
            aria-describedby="basetime-hint"
            aria-errormessage="basetime-err"
          />
          <div id="basetime-err" class="error-msg">
            <span aria-hidden="true">❌</span> Please pick a valid start time.
          </div>
        </div>

        <div class="field">
          <label for="cronJitterInput">Random Jitter Window in Minutes (<code>CRON_JITTER_MINUTES</code>)</label>
          <span id="jitter-hint" class="hint">Random delay (0–720 mins) added to start time each day (default: 60 mins)</span>
          <input
            type="number"
            id="cronJitterInput"
            min="0"
            max="720"
            required
            value="60"
            aria-describedby="jitter-hint"
            aria-errormessage="jitter-err"
          />
          <div id="jitter-err" class="error-msg">
            <span aria-hidden="true">❌</span> Enter a number between 0 and 720 minutes.
          </div>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:0.5rem;margin-top:1rem;">
          <button type="button" class="btn" onclick="document.getElementById('cronFormDialog').close()">Cancel</button>
          <button type="submit" class="btn btn-primary">💾 Save Schedule to .env</button>
        </div>
      </form>
    </div>
  </dialog>

  <!-- Dialog 3: Email Alert Template Preview -->
  <dialog id="emailPreviewDialog" closedby="any" aria-labelledby="emailPreviewTitle">
    <div class="dialog-inner">
      <div class="dialog-header">
        <div>
          <h3 id="emailPreviewTitle" style="margin:0;font-size:1.05rem;">Resend Email Alert Template Preview</h3>
          <div id="emailPreviewSubject" style="font-size:0.82rem;color:var(--text-muted);margin-top:0.2rem;"></div>
        </div>
        <form method="dialog">
          <button type="submit" class="btn btn-sm">✕ Close</button>
        </form>
      </div>
      <iframe
        id="emailPreviewFrame"
        title="Email Alert HTML Preview"
        style="width:100%;height:480px;border:1px solid var(--border);border-radius:8px;background:#fff;"
      ></iframe>
    </div>
  </dialog>

  <!-- Dialog 4: Competing Seller Offers (Sortable Table) -->
  <dialog id="sellerOffersDialog" closedby="any" aria-labelledby="sellerOffersTitle">
    <div class="dialog-inner">
      <div class="dialog-header">
        <div>
          <h3 id="sellerOffersTitle" style="margin:0;font-size:1.05rem;">Competing Third-Party Seller Offers</h3>
          <div id="sellerOffersSub" style="font-size:0.82rem;color:var(--text-muted);margin-top:0.2rem;"></div>
        </div>
        <form method="dialog">
          <button type="submit" class="btn btn-sm">✕ Close</button>
        </form>
      </div>
      <div tabindex="0" role="region" aria-labelledby="offers-modal-caption" class="table-wrapper">
        <table id="offersTable" style="--label-2:'Price';--label-3:'Cashback';--label-4:'Rating';--label-5:'Badge';--label-6:'Store Link';">
          <caption id="offers-modal-caption">Competing seller offers for selected product</caption>
          <thead>
            <tr>
              <th class="sortable" data-table="offers" data-sort-key="sellerName" aria-sort="none">Seller / Merchant <span class="sort-icon">↕</span></th>
              <th class="sortable" data-table="offers" data-sort-key="price" aria-sort="ascending">Price <span class="sort-icon">↑</span></th>
              <th class="sortable" data-table="offers" data-sort-key="cashbackPct" aria-sort="none">Cashback <span class="sort-icon">↕</span></th>
              <th class="sortable" data-table="offers" data-sort-key="ratingScore" aria-sort="none">Rating <span class="sort-icon">↕</span></th>
              <th class="sortable" data-table="offers" data-sort-key="placement" aria-sort="none">Placement <span class="sort-icon">↕</span></th>
              <th>Vendor Link</th>
            </tr>
          </thead>
          <tbody id="sellerOffersBody"></tbody>
        </table>
      </div>
    </div>
  </dialog>

  <div id="toast" class="toast" role="status" aria-live="polite"></div>

  <script>
    // 1. Light-dismiss fallback for browsers without native <dialog closedby="any"> support
    // (modern-web-guidance: light-dismiss-a-dialog)
    document.querySelectorAll('dialog').forEach((dialog) => {
      if (!('closedBy' in HTMLDialogElement.prototype)) {
        dialog.addEventListener('click', (event) => {
          if (event.target !== dialog) return;
          const rect = dialog.getBoundingClientRect();
          const isDialogContent = (
            rect.top <= event.clientY &&
            event.clientY <= rect.top + rect.height &&
            rect.left <= event.clientX &&
            event.clientX <= rect.left + rect.width
          );
          if (isDialogContent) return;
          dialog.close();
        });
      }
    });

    // 2. Deferred input validation fallback & ARIA sync
    // (modern-web-guidance: validate-input-after-interaction)
    const UserInvalidFallback = (() => {
      const dirtyState = new WeakMap();
      const updateState = (input) => {
        const isValid = input.checkValidity();
        input.classList.toggle('user-invalid-fallback', !isValid);
        input.classList.toggle('user-valid-fallback', isValid);
        if (!isValid) {
          input.setAttribute('aria-invalid', 'true');
        } else {
          input.removeAttribute('aria-invalid');
        }
      };
      const handleEvent = (event) => {
        const input = event.target;
        if (event.type === 'reset') {
          const controls = input.elements || [];
          for (const control of controls) {
            dirtyState.delete(control);
            control.classList.remove('user-invalid-fallback', 'user-valid-fallback');
            control.removeAttribute('aria-invalid');
          }
          return;
        }
        if (!input || !input.checkValidity) return;
        if (event.type === 'input' || event.type === 'change') {
          const state = dirtyState.get(input) || { hasInteracted: false, hasBlurred: false };
          state.hasInteracted = true;
          dirtyState.set(input, state);
          if (state.hasBlurred) updateState(input);
        } else if (event.type === 'blur') {
          const state = dirtyState.get(input) || { hasInteracted: false, hasBlurred: false };
          state.hasBlurred = true;
          dirtyState.set(input, state);
          if (state.hasInteracted) updateState(input);
        }
      };
      const init = (root = document) => {
        if (CSS.supports('selector(:user-invalid)')) return;
        root.addEventListener('blur', handleEvent, true);
        root.addEventListener('input', handleEvent);
        root.addEventListener('change', handleEvent);
        root.addEventListener('reset', handleEvent, true);
      };
      return { init };
    })();
    UserInvalidFallback.init(document);

    const syncAria = (el) => {
      if (el && el.matches && el.setAttribute) {
        try {
          el.setAttribute('aria-invalid', el.matches(':user-invalid') ? 'true' : 'false');
        } catch {}
      }
    };
    document.addEventListener('blur', (e) => syncAria(e.target), true);
    document.addEventListener('input', (e) => {
      if (e.target && e.target.hasAttribute && e.target.hasAttribute('aria-invalid')) syncAria(e.target);
    });

    // 3. Universal Table Sort State & Comparator (All tables sortable)
    const tableSortState = {
      providers: { key: 'provider', dir: 'asc' },
      enebaSummary: { key: 'avgEffective', dir: 'desc' },
      enebaDeals: { key: 'effectiveDiscountPct', dir: 'desc' },
      pages: { key: 'categoryName', dir: 'asc' },
      config: { key: 'group', dir: 'asc' },
      offers: { key: 'price', dir: 'asc' },
    };

    let dashboardData = null;
    let showSecrets = false;
    let isConfigEditing = false;
    let activeOffersModalIdx = null;

    function compareValues(a, b, dir) {
      const mul = dir === 'asc' ? 1 : -1;
      if (a === null || a === undefined) return 1;
      if (b === null || b === undefined) return -1;
      if (typeof a === 'number' && typeof b === 'number') {
        return (a - b) * mul;
      }
      if (typeof a === 'boolean' && typeof b === 'boolean') {
        return (Number(a) - Number(b)) * mul;
      }
      return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' }) * mul;
    }

    function updateSortHeaders(tableName) {
      const state = tableSortState[tableName];
      document.querySelectorAll('th.sortable[data-table="' + tableName + '"]').forEach((th) => {
        const key = th.dataset.sortKey;
        const icon = th.querySelector('.sort-icon');
        if (key === state.key) {
          th.setAttribute('aria-sort', state.dir === 'asc' ? 'ascending' : 'descending');
          if (icon) icon.textContent = state.dir === 'asc' ? '↑' : '↓';
        } else {
          th.setAttribute('aria-sort', 'none');
          if (icon) icon.textContent = '↕';
        }
      });
    }

    document.querySelectorAll('th.sortable').forEach((th) => {
      th.addEventListener('click', () => {
        const tableName = th.dataset.table;
        const key = th.dataset.sortKey;
        const current = tableSortState[tableName];
        if (current.key === key) {
          current.dir = current.dir === 'asc' ? 'desc' : 'asc';
        } else {
          current.key = key;
          current.dir = 'asc';
        }
        updateSortHeaders(tableName);
        if (tableName === 'offers' && activeOffersModalIdx !== null) {
          renderSellerOffersModal(activeOffersModalIdx);
        } else {
          renderAll();
        }
      });
    });

    function showToast(msg) {
      const el = document.getElementById('toast');
      el.textContent = msg;
      el.classList.add('show');
      clearTimeout(el._timer);
      el._timer = setTimeout(() => el.classList.remove('show'), 3800);
    }

    function escapeHtml(str) {
      return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    // Navigation & URL Route Sync (/ , /eneba , /scraping , /config)
    window.switchTab = (tabName, pushUrl = true) => {
      document.querySelectorAll('.tab-btn').forEach((b) => {
        b.classList.toggle('active', b.dataset.tab === tabName);
      });
      document.querySelectorAll('.tab-panel').forEach((p) => {
        p.classList.toggle('active', p.id === 'tab-' + tabName);
      });
      if (pushUrl) {
        const btn = document.querySelector('.tab-btn[data-tab="' + tabName + '"]');
        const route = btn?.dataset?.route || '/';
        if (window.location.pathname !== route) {
          window.history.pushState({ tab: tabName }, '', route);
        }
      }
    };

    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab, true));
    });

    function syncTabFromPath() {
      const p = window.location.pathname;
      if (p === '/eneba') switchTab('eneba', false);
      else if (p === '/scraping') switchTab('scraping', false);
      else if (p === '/config') switchTab('config', false);
      else switchTab('home', false);
    }
    window.addEventListener('popstate', syncTabFromPath);
    syncTabFromPath();

    async function fetchDashboard() {
      const res = await fetch('/api/dashboard');
      dashboardData = await res.json();
      renderAll();
    }

    function renderAll() {
      if (!dashboardData) return;
      const { pages, statuses, runner, scheduler, env } = dashboardData;
      const thresholdPct = Number(env.values.ALERT_DISCOUNT_THRESHOLD_PCT || 20);

      // Update Nav count & Global Home KPIs
      document.getElementById('navPagesCount').textContent = pages.length;
      const enabledCount = pages.filter((p) => p.enabled).length;
      const providers = Array.from(new Set(pages.map((p) => p.provider)));
      document.getElementById('kpiProvidersCount').textContent = providers.length + (providers.length === 1 ? ' Provider' : ' Providers');
      document.getElementById('kpiPagesSub').textContent = enabledCount + ' / ' + pages.length + ' active scrape pages (' + providers.join(', ') + ')';

      // Last Scraped KPI
      let latestScrapedMs = 0;
      statuses.forEach((st) => {
        const t = new Date(st.scrapedAt).getTime();
        if (t > latestScrapedMs) latestScrapedMs = t;
      });
      document.getElementById('kpiLastScrapedTime').textContent = latestScrapedMs
        ? new Date(latestScrapedMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : 'Never';
      document.getElementById('kpiLastScrapedSub').textContent = latestScrapedMs
        ? 'Provider: eneba (' + new Date(latestScrapedMs).toLocaleDateString() + ')'
        : 'Provider: eneba (No scrapes yet)';

      // Scheduler KPI & Read-Only View Card
      if (scheduler.enabled && scheduler.nextRunAt) {
        const nextDate = new Date(scheduler.nextRunAt);
        document.getElementById('kpiNextCron').textContent = nextDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        document.getElementById('kpiCronWindow').textContent =
          'Base ' + scheduler.baseTime + ' + ' + scheduler.chosenOffsetMinutes + 'm ' + scheduler.chosenOffsetSeconds + 's jitter';
        document.getElementById('viewCronEnabled').innerHTML = '<span class="badge badge-discount">Enabled</span>';
        document.getElementById('viewCronWindow').textContent = scheduler.baseTime + ' + [0..' + scheduler.jitterMinutes + ' mins]';
        document.getElementById('viewCronOffset').textContent = '+' + scheduler.chosenOffsetMinutes + 'm ' + scheduler.chosenOffsetSeconds + 's';
        document.getElementById('viewCronNext').textContent = nextDate.toLocaleString();
      } else {
        document.getElementById('kpiNextCron').textContent = 'Disabled';
        document.getElementById('kpiCronWindow').textContent = 'Enable in Scraping & Targets tab';
        document.getElementById('viewCronEnabled').innerHTML = '<span class="badge badge-muted">Disabled</span>';
        document.getElementById('viewCronWindow').textContent = scheduler.baseTime + ' + [0..' + scheduler.jitterMinutes + ' mins]';
        document.getElementById('viewCronOffset').textContent = '—';
        document.getElementById('viewCronNext').textContent = 'Paused';
      }
      document.getElementById('viewCronLast').textContent =
        scheduler.lastRunAt ? new Date(scheduler.lastRunAt).toLocaleString() + ' (' + scheduler.lastRunStatus + ')' : 'No scheduled run yet';

      // Alert & DB KPI
      document.getElementById('kpiAlertThreshold').textContent = 'Active';
      const emailActive = String(env.values.EMAIL_ENABLED).toLowerCase() === 'true';
      document.getElementById('kpiDbStatus').textContent =
        'Email: ' + (emailActive ? 'Enabled (≥' + thresholdPct + '%)' : 'Standby') + ' • PostgreSQL Ready';

      // Live Scrape Banner
      const banner = document.getElementById('scrapeBanner');
      const btnScrapeAll = document.getElementById('btnScrapeAll');
      const btnScrapeFast = document.getElementById('btnScrapeFast');
      if (runner.isScraping) {
        banner.classList.add('active');
        document.getElementById('scrapeStepText').textContent = runner.currentStep || 'Scraping pages...';
        document.getElementById('scrapeProgressSub').textContent =
          'Started at ' + (runner.startedAt ? new Date(runner.startedAt).toLocaleTimeString() : '');
        document.getElementById('scrapeProgressBadge').textContent =
          runner.completedPages + ' / ' + runner.totalPages + ' Pages';
        btnScrapeAll.disabled = true;
        btnScrapeFast.disabled = true;
      } else {
        banner.classList.remove('active');
        btnScrapeAll.disabled = false;
        btnScrapeFast.disabled = false;
      }

      // Render HOME Page Tables (Provider Overview, No Deals)
      renderProvidersOverviewTable(pages, statuses);

      // Render ENEBA Dedicated Page KPIs & Tables
      renderEnebaPage(pages, statuses, thresholdPct);

      // Render Logs
      const logBox = document.getElementById('logBox');
      logBox.innerHTML = (runner.recentLogs && runner.recentLogs.length > 0)
        ? runner.recentLogs.map((l) => '<div>' + escapeHtml(l) + '</div>').join('')
        : 'Ready. Waiting for scrape actions.';

      // Render Scraping Pages Table
      renderPagesTable(pages);

      // Render Configuration Table & Edit Form
      renderConfigTable(env);
      if (!isConfigEditing) {
        renderEnvEditorFields(env);
      }
    }

    // HOME TABLE 1: Monitored Store Providers Overview (No Deals)
    function renderProvidersOverviewTable(pages, statuses) {
      const tbody = document.getElementById('providersTableBody');
      const providerNames = Array.from(new Set([...pages.map((p) => p.provider), 'eneba']));

      let latestEnebaScrapedMs = 0;
      statuses.forEach((st) => {
        const t = new Date(st.scrapedAt).getTime();
        if (t > latestEnebaScrapedMs) latestEnebaScrapedMs = t;
      });

      const rows = providerNames.map((prov) => {
        const provPages = pages.filter((p) => p.provider === prov);
        const activePages = provPages.filter((p) => p.enabled).length;
        const lastScraped = prov === 'eneba' ? latestEnebaScrapedMs : 0;
        const pageNames = provPages.map((p) => p.categoryName).join(', ');

        return {
          provider: prov,
          activePages,
          totalPages: provPages.length,
          pageNames,
          status: activePages > 0 ? 'Active' : 'Standby',
          lastScraped,
        };
      });

      const sort = tableSortState.providers;
      rows.sort((a, b) => compareValues(a[sort.key], b[sort.key], sort.dir));

      tbody.innerHTML = rows.map((r) => {
        const lastScrapedStr = r.lastScraped
          ? new Date(r.lastScraped).toLocaleString()
          : '<span style="color:var(--text-muted);">Never</span>';

        return '<tr>' +
          '<th><span class="badge badge-provider">' + escapeHtml(r.provider) + '</span></th>' +
          '<td><strong>' + r.activePages + ' / ' + r.totalPages + ' pages</strong>' +
            (r.pageNames ? ' <span style="font-size:0.78rem;color:var(--text-muted);">(' + escapeHtml(r.pageNames) + ')</span>' : '') +
          '</td>' +
          '<td><span class="badge ' + (r.activePages > 0 ? 'badge-discount' : 'badge-muted') + '">' + r.status + '</span></td>' +
          '<td style="color:var(--text);font-size:0.85rem;">' + lastScrapedStr + '</td>' +
          '<td>' + (r.provider === 'eneba'
            ? '<button type="button" class="btn btn-sm btn-primary" onclick="switchTab(\\'eneba\\')">View Eneba Deals →</button>'
            : '<span class="badge badge-muted">Custom</span>') + '</td>' +
        '</tr>';
      }).join('');
    }

    // DEDICATED ENEBA PAGE RENDERER (/eneba)
    function renderEnebaPage(pages, statuses, thresholdPct) {
      const enebaPages = pages.filter((p) => p.provider === 'eneba');
      document.getElementById('enebaKpiCategories').textContent = statuses.length + ' / ' + enebaPages.length + ' Scraped';

      const totalInStock = statuses.reduce((s, st) => s + (st.inStockCount || 0), 0);
      const totalDiscounted = statuses.reduce((s, st) => s + (st.discountedCount || 0), 0);
      document.getElementById('enebaKpiInStock').textContent = totalInStock + ' Cards';
      document.getElementById('enebaKpiDiscounted').textContent = totalDiscounted + ' with direct discount';

      let bestEneba = null;
      let totalOffers = 0;
      statuses.forEach((st) => {
        totalOffers += st.bestDealOffers ? st.bestDealOffers.length : 0;
        const b = st.bestEffectiveDeal || st.bestDeal;
        if (b && (!bestEneba || b.effectiveDiscountPct > bestEneba.effectiveDiscountPct)) {
          bestEneba = b;
        }
      });

      document.getElementById('enebaKpiBestPct').textContent = bestEneba ? '-' + bestEneba.effectiveDiscountPct.toFixed(2) + '%' : '0.00%';
      document.getElementById('enebaKpiBestTitle').textContent = bestEneba
        ? bestEneba.title + ' ($' + (bestEneba.sellingPrice?.toFixed(2) ?? 'N/A') + ')'
        : 'No Eneba deals scraped yet';
      document.getElementById('enebaKpiOffersCount').textContent = totalOffers + ' Offers';

      // Eneba Summary Table
      const summaryBody = document.getElementById('enebaSummaryBody');
      if (!statuses || statuses.length === 0) {
        summaryBody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);">No Eneba scrape results yet. Click "Scrape Eneba Pages" above.</td></tr>';
      } else {
        const sort = tableSortState.enebaSummary;
        const indexed = statuses.map((st, originalIdx) => {
          const best = st.bestEffectiveDeal || st.bestDeal;
          return {
            st,
            originalIdx,
            category: st.category,
            inStockCount: st.inStockCount,
            avgDirect: st.averageDiscountPctOnDiscounted,
            avgEffective: st.averageEffectiveDiscountPct,
            bestEffective: best ? best.effectiveDiscountPct : -1,
            offersCount: st.bestDealOffers ? st.bestDealOffers.length : 0,
            scrapedAt: new Date(st.scrapedAt).getTime(),
          };
        });

        indexed.sort((a, b) => compareValues(a[sort.key], b[sort.key], sort.dir));

        summaryBody.innerHTML = indexed.map((item) => {
          const { st, originalIdx } = item;
          const best = st.bestEffectiveDeal || st.bestDeal;
          const offersCount = st.bestDealOffers ? st.bestDealOffers.length : 0;
          const bestHtml = best
            ? '<a href="' + escapeHtml(best.url) + '" target="_blank" rel="noopener"><strong>-' +
              best.effectiveDiscountPct.toFixed(2) + '% ($' + (best.sellingPrice?.toFixed(2) ?? 'N/A') + ')</strong> — ' +
              escapeHtml(best.title) + '</a>'
            : '<span style="color:var(--text-muted);">None in stock</span>';

          return '<tr>' +
            '<th>' + escapeHtml(st.category) + '</th>' +
            '<td>' + st.inStockCount + ' / ' + st.totalListings + '</td>' +
            '<td>' + st.averageDiscountPctOnDiscounted.toFixed(2) + '%</td>' +
            '<td><span class="badge badge-discount">' + st.averageEffectiveDiscountPct.toFixed(2) + '%</span></td>' +
            '<td>' + bestHtml + '</td>' +
            '<td>' + (offersCount > 0
              ? '<button type="button" class="btn btn-sm" onclick="openSellerOffers(' + originalIdx + ')">View ' + offersCount + ' Sellers</button>'
              : '<span style="color:var(--text-muted);">0 offers</span>') + '</td>' +
            '<td style="color:var(--text-muted);font-size:0.8rem;">' + new Date(st.scrapedAt).toLocaleString() + '</td>' +
          '</tr>';
        }).join('');
      }

      // Populate Eneba Category Filter & Render Eneba Top Deals Table
      const pullLimit = parseInt(dashboardData?.enebaConfig?.top_deals_limit || '10', 10) || 10;
      const enebaAlertThreshold = parseFloat(dashboardData?.enebaConfig?.alert_discount_threshold_pct || '20') || 20;

      const limitInput = document.getElementById('enebaTopDealsLimitInput');
      if (limitInput && document.activeElement !== limitInput) {
        limitInput.value = pullLimit;
      }
      const thresholdInput = document.getElementById('enebaAlertThresholdInput');
      if (thresholdInput && document.activeElement !== thresholdInput) {
        thresholdInput.value = enebaAlertThreshold;
      }
      const badge = document.getElementById('enebaPullLimitBadge');
      if (badge) badge.textContent = pullLimit;

      const catSelect = document.getElementById('enebaCategoryFilter');
      const currentCat = catSelect.value;
      const categories = statuses.map((s) => s.category);
      catSelect.innerHTML = '<option value="all">All Eneba Categories (' + statuses.length + ')</option>' +
        categories.map((c) => '<option value="' + escapeHtml(c) + '"' + (c === currentCat ? ' selected' : '') + '>' + escapeHtml(c) + '</option>').join('');

      const dealsBody = document.getElementById('enebaDealsBody');
      const searchQ = (document.getElementById('enebaSearchInput')?.value || '').trim().toLowerCase();
      const filteredStatuses = catSelect.value === 'all'
        ? statuses
        : statuses.filter((s) => s.category === catSelect.value);

      const flatDeals = [];
      filteredStatuses.forEach((st) => {
        (st.rankedDeals || []).slice(0, pullLimit).forEach((deal, idx) => {
          const rank = idx + 1;
          if (searchQ) {
            const hay = (deal.title + ' ' + st.category + ' ' + deal.region).toLowerCase();
            if (!searchQ.split(/\\s+/).every((tok) => hay.includes(tok))) return;
          }
          flatDeals.push({
            rank,
            title: deal.title,
            category: st.category,
            region: deal.region,
            sellingPrice: deal.sellingPrice ?? 999999,
            originalPrice: deal.originalPrice ?? deal.faceValue,
            discountPct: deal.discountPct,
            effectiveDiscountPct: deal.effectiveDiscountPct,
            cashbackPct: deal.cashbackPct,
            effectivePrice: deal.effectivePrice,
            scrapedAt: new Date(st.scrapedAt).getTime(),
            scrapedAtIso: st.scrapedAt,
            url: deal.url,
          });
        });
      });

      const sort = tableSortState.enebaDeals;
      flatDeals.sort((a, b) => compareValues(a[sort.key], b[sort.key], sort.dir));

      if (flatDeals.length === 0) {
        dealsBody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text-muted);">No matching Eneba deals found.</td></tr>';
        return;
      }

      dealsBody.innerHTML = flatDeals.map((deal) => {
        const isAlertMatch = Math.max(deal.discountPct, deal.effectiveDiscountPct) >= enebaAlertThreshold;
        const priceDisplay = deal.sellingPrice < 999999 ? '$' + deal.sellingPrice.toFixed(2) : 'N/A';
        return '<tr>' +
          '<th>#' + deal.rank + '</th>' +
          '<td><strong>' + escapeHtml(deal.title) + '</strong>' +
            (isAlertMatch ? ' <span class="badge badge-alert" title="Meets email alert threshold">🔥 &ge;' + enebaAlertThreshold + '%</span>' : '') +
          '</td>' +
          '<td>' + escapeHtml(deal.category) + '</td>' +
          '<td>' + escapeHtml(deal.region) + '</td>' +
          '<td><strong>' + priceDisplay + '</strong>' +
            (deal.originalPrice ? ' <span style="color:var(--text-muted);text-decoration:line-through;font-size:0.78rem;">$' + deal.originalPrice.toFixed(2) + '</span>' : '') +
          '</td>' +
          '<td>-' + deal.discountPct.toFixed(2) + '%</td>' +
          '<td><span class="badge badge-discount">-' + deal.effectiveDiscountPct.toFixed(2) + '%</span>' +
            (deal.cashbackPct > 0 ? ' <span style="font-size:0.75rem;color:var(--text-muted);">(+' + deal.cashbackPct.toFixed(1) + '% CB → $' + (deal.effectivePrice?.toFixed(2) ?? '') + ')</span>' : '') +
          '</td>' +
          '<td style="color:var(--text-muted);font-size:0.8rem;">' + (deal.scrapedAtIso ? new Date(deal.scrapedAtIso).toLocaleString() : '—') + '</td>' +
          '<td><a href="' + escapeHtml(deal.url) + '" target="_blank" rel="noopener" class="btn btn-sm">Eneba ↗</a></td>' +
        '</tr>';
      }).join('');
    }

    function renderPagesTable(pages) {
      const pagesBody = document.getElementById('pagesTableBody');
      const sort = tableSortState.pages;
      const sorted = [...pages].sort((a, b) => compareValues(a[sort.key], b[sort.key], sort.dir));

      pagesBody.innerHTML = sorted.map((p) => {
        return '<tr>' +
          '<th>' + escapeHtml(p.categoryName) + '</th>' +
          '<td><span class="badge badge-provider">' + escapeHtml(p.provider) + '</span></td>' +
          '<td><a href="' + escapeHtml(p.url) + '" target="_blank" rel="noopener">' + escapeHtml(p.url) + '</a></td>' +
          '<td>' + (p.withOffers ? '<span class="badge badge-discount">With Offers</span>' : '<span class="badge badge-muted">Listing Only</span>') + '</td>' +
          '<td>' + (p.enabled ? '<span class="badge badge-discount">Enabled</span>' : '<span class="badge badge-muted">Disabled</span>') + '</td>' +
          '<td style="display:flex;gap:0.4rem;flex-wrap:wrap;">' +
            '<button type="button" class="btn btn-sm btn-primary" onclick="scrapeSinglePage(\\'' + escapeHtml(p.id) + '\\')">▶ Scrape</button>' +
            '<button type="button" class="btn btn-sm" onclick="openEditPageModal(\\'' + escapeHtml(p.id) + '\\')">✎ Edit</button>' +
            '<button type="button" class="btn btn-sm btn-danger" onclick="deletePage(\\'' + escapeHtml(p.id) + '\\')">Delete</button>' +
          '</td>' +
        '</tr>';
      }).join('');
    }

    function renderConfigTable(env) {
      document.getElementById('envFilePathLabel').textContent = env.envFilePath || '.env';
      const tbody = document.getElementById('configTableBody');
      const schemaByKey = new Map((env.schema || []).map((f) => [f.key, f]));
      const allKeys = Array.from(new Set([...schemaByKey.keys(), ...Object.keys(env.values || {})]));

      const rows = allKeys.map((key) => {
        const meta = schemaByKey.get(key);
        const val = env.values[key] ?? '';
        const isEnvOnly = Boolean(meta?.envOnly) || key === 'PORT' || key === 'DATABASE_URL';
        const isSecret = meta?.isSecret || /PASSWORD|SECRET|KEY|DATABASE_URL/i.test(key);
        const displayVal = !val
          ? '<span style="color:var(--text-muted);font-style:italic;">(empty)</span>'
          : (isSecret && !showSecrets ? '••••••••••••••••' : '<code>' + escapeHtml(val) + '</code>');
        return {
          key,
          group: meta ? meta.group : 'custom',
          isEnvOnly,
          storage: isEnvOnly ? '.env (locked)' : 'scrapling.config',
          value: val,
          displayVal,
          description: meta ? meta.description : 'Custom configuration variable in scrapling.config',
        };
      });

      const sort = tableSortState.config;
      rows.sort((a, b) => compareValues(a[sort.key], b[sort.key], sort.dir));

      tbody.innerHTML = rows.map((r) => {
        const storageBadge = r.isEnvOnly
          ? '<span class="badge badge-alert" title="Change in .env and require restart if changed">🔒 .env (Restart Required)</span>'
          : '<span class="badge badge-discount">🗄️ scrapling.config</span>';

        return '<tr>' +
          '<th><code>' + escapeHtml(r.key) + '</code></th>' +
          '<td><span class="badge badge-provider">' + escapeHtml(r.group) + '</span></td>' +
          '<td>' + storageBadge + '</td>' +
          '<td>' + r.displayVal + '</td>' +
          '<td style="color:var(--text-muted);font-size:0.82rem;">' + escapeHtml(r.description) + '</td>' +
        '</tr>';
      }).join('');
    }

    function renderEnvEditorFields(env) {
      const container = document.getElementById('envFieldsContainer');
      const schemaByKey = new Map((env.schema || []).map((f) => [f.key, f]));
      const allKeys = Array.from(new Set([...schemaByKey.keys(), ...Object.keys(env.values || {})]));

      const sections = [
        {
          id: 'env',
          title: '🔒 Section 1: Boot & Database Environment (.env — Read-Only, Requires Restart)',
          subtitle: 'These settings sit in .env and cannot be changed from the UI. Change in .env and restart the server if modified.',
        },
        {
          id: 'scrapling',
          title: '🕸️ Section 2: Scrapling MCP Engine & Timezone (scrapling.config)',
          subtitle: 'Stored in PostgreSQL table scrapling.config and applied immediately.',
        },
        {
          id: 'scheduler',
          title: '⏰ Section 3: Daily Randomized Cron Scheduler (scrapling.config)',
          subtitle: 'Controls the daily scrape window (base start time + random jitter minutes).',
        },
        {
          id: 'email',
          title: '✉️ Section 4: Resend Email Deal Alerts (scrapling.config)',
          subtitle: 'Controls email notification recipient, sender, API key, and discount % threshold.',
        },
        {
          id: 'custom',
          title: '🧩 Section 5: Custom Configuration Variables (scrapling.config)',
          subtitle: 'User-defined keys stored in PostgreSQL table scrapling.config.',
        },
      ];

      const grouped = new Map(sections.map((s) => [s.id, []]));
      allKeys.forEach((key) => {
        const meta = schemaByKey.get(key);
        const groupId = meta?.group && grouped.has(meta.group) ? meta.group : 'custom';
        grouped.get(groupId).push(key);
      });

      container.innerHTML = sections.map((sec) => {
        const keys = grouped.get(sec.id) || [];
        if (keys.length === 0) return '';

        const fieldsHtml = keys.map((key) => {
          const meta = schemaByKey.get(key);
          const val = env.values[key] ?? '';
          const isEnvOnly = Boolean(meta?.envOnly) || key === 'PORT' || key === 'DATABASE_URL';
          const isSecret = meta?.isSecret || /PASSWORD|SECRET|KEY|DATABASE_URL/i.test(key);
          const inputType = isSecret && !showSecrets ? 'password' : 'text';
          const desc = meta ? meta.description : 'Custom configuration variable';
          const tooltipAttr = isEnvOnly
            ? ' disabled title="Change in .env and require restart if changed" style="opacity:0.65;cursor:not-allowed;"'
            : '';

          return '<div class="field" style="background:var(--bg-panel-alt);padding:0.85rem;border:1px solid var(--border);border-radius:10px;"' +
            (isEnvOnly ? ' title="Change in .env and require restart if changed"' : '') + '>' +
            '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.4rem;">' +
              '<label for="env_' + escapeHtml(key) + '"><code>' + escapeHtml(key) + '</code></label>' +
              (isEnvOnly
                ? '<span class="badge badge-alert" title="Change in .env and require restart if changed">🔒 Change in .env (Restart Required)</span>'
                : (!meta
                  ? '<button type="button" class="btn btn-sm btn-danger" onclick="removeEnvKey(\\'' + escapeHtml(key) + '\\')">Remove</button>'
                  : '<span class="badge badge-discount">scrapling.config</span>')) +
            '</div>' +
            '<span id="hint_' + escapeHtml(key) + '" class="hint">' + escapeHtml(desc) + '</span>' +
            '<input type="' + inputType + '" id="env_' + escapeHtml(key) + '"' +
              (isEnvOnly ? '' : ' data-env-key="' + escapeHtml(key) + '"') +
              ' value="' + escapeHtml(val) + '" aria-describedby="hint_' + escapeHtml(key) + '"' + tooltipAttr + ' />' +
          '</div>';
        }).join('');

        return '<div style="margin-block-end:1.4rem;padding-block-end:1rem;border-block-end:1px solid var(--border);">' +
          '<h3 style="margin:0 0 0.2rem;font-size:0.95rem;color:#e2e8f0;">' + escapeHtml(sec.title) + '</h3>' +
          '<div style="font-size:0.78rem;color:var(--text-muted);margin-block-end:0.85rem;">' + escapeHtml(sec.subtitle) + '</div>' +
          '<div class="form-grid">' + fieldsHtml + '</div>' +
        '</div>';
      }).join('');
    }

    // Filter listeners & Eneba configuration
    document.getElementById('enebaCategoryFilter').addEventListener('change', () => renderAll());
    document.getElementById('enebaSearchInput').addEventListener('input', () => renderAll());
    document.getElementById('btnSaveEnebaConfig').addEventListener('click', async () => {
      const pullVal = parseInt(document.getElementById('enebaTopDealsLimitInput')?.value || '10', 10);
      if (!pullVal || pullVal < 1 || pullVal > 100) {
        showToast('Please enter a valid pull limit between 1 and 100.');
        return;
      }
      const threshVal = parseFloat(document.getElementById('enebaAlertThresholdInput')?.value || '20');
      if (Number.isNaN(threshVal) || threshVal < 0 || threshVal > 100) {
        showToast('Please enter a valid alert discount threshold between 0 and 100%.');
        return;
      }
      try {
        const res = await fetch('/api/eneba/config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            updates: {
              top_deals_limit: String(pullVal),
              alert_discount_threshold_pct: String(threshVal),
            },
          }),
        });
        const data = await res.json();
        if (dashboardData) {
          dashboardData.enebaConfig = data.config;
        }
        showToast('Eneba configuration saved! (Limit: ' + pullVal + ', Alert: ≥' + threshVal + '%) in scrapling.eneba_config');
        renderAll();
      } catch (err) {
        showToast('Failed to update Eneba config: ' + (err.message || err));
      }
    });

    // Competing seller offers modal (with sortable columns)
    window.openSellerOffers = (statusIdx) => {
      activeOffersModalIdx = statusIdx;
      renderSellerOffersModal(statusIdx);
      document.getElementById('sellerOffersDialog').showModal();
    };

    function renderSellerOffersModal(statusIdx) {
      const st = dashboardData?.statuses?.[statusIdx];
      if (!st) return;
      const best = st.bestEffectiveDeal || st.bestDeal;
      document.getElementById('sellerOffersSub').textContent =
        (best ? best.title : st.category) + ' — ' + (st.bestDealOffers?.length || 0) + ' competing merchant offers';
      const tbody = document.getElementById('sellerOffersBody');
      const offers = [...(st.bestDealOffers || [])].map((o) => ({
        ...o,
        placement: o.isLowestPrice ? 1 : (o.isFeaturedOffer ? 2 : 3),
      }));

      const sort = tableSortState.offers;
      offers.sort((a, b) => compareValues(a[sort.key], b[sort.key], sort.dir));

      tbody.innerHTML = offers.map((o) => {
        return '<tr>' +
          '<th>' + escapeHtml(o.sellerName) + '</th>' +
          '<td><strong>$' + Number(o.price).toFixed(2) + '</strong></td>' +
          '<td>' + (o.cashbackPct > 0 ? o.cashbackPct.toFixed(1) + '%' : '—') + '</td>' +
          '<td>' + (o.ratingScore ? o.ratingScore.toFixed(2) + '%' : 'N/A') + (o.ratingLabel ? ' (' + escapeHtml(o.ratingLabel) + ')' : '') + '</td>' +
          '<td>' + (o.isLowestPrice ? '<span class="badge badge-discount">Lowest Price</span> ' : '') +
            (o.isFeaturedOffer ? '<span class="badge badge-provider">Recommended</span>' : '') + '</td>' +
          '<td>' + (o.sellerUrl ? '<a href="' + escapeHtml(o.sellerUrl) + '" target="_blank" rel="noopener">Merchant Page ↗</a>' : '—') + '</td>' +
        '</tr>';
      }).join('');
    }

    // Scrape triggers
    window.triggerScrape = async (payload) => {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload || {}),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast('Error: ' + (data.error || 'Unable to start scrape'));
        return;
      }
      showToast('Scrape started! Live progress is shown at the top.');
      await fetchDashboard();
    };

    document.getElementById('btnScrapeAll').addEventListener('click', () => window.triggerScrape({}));
    document.getElementById('btnScrapeFast').addEventListener('click', () => window.triggerScrape({ withOffers: false }));
    window.scrapeSinglePage = (pageId) => window.triggerScrape({ pageId });

    // Add / Edit Scraping Page Modal
    document.getElementById('btnOpenAddPageDialog').addEventListener('click', () => {
      document.getElementById('pageFormDialogTitle').textContent = 'Add Scraping Page';
      document.getElementById('editPageId').value = '';
      document.getElementById('newPageProvider').value = 'eneba';
      document.getElementById('newPageCategory').value = '';
      document.getElementById('newPageUrl').value = '';
      document.getElementById('newPageWithOffers').checked = true;
      document.getElementById('newPageEnabled').checked = true;
      document.getElementById('pageFormDialog').showModal();
    });

    window.openEditPageModal = (pageId) => {
      const page = (dashboardData?.pages || []).find((p) => p.id === pageId);
      if (!page) return;
      document.getElementById('pageFormDialogTitle').textContent = 'Edit Scraping Page';
      document.getElementById('editPageId').value = page.id;
      document.getElementById('newPageProvider').value = page.provider;
      document.getElementById('newPageCategory').value = page.categoryName;
      document.getElementById('newPageUrl').value = page.url;
      document.getElementById('newPageWithOffers').checked = page.withOffers;
      document.getElementById('newPageEnabled').checked = page.enabled;
      document.getElementById('pageFormDialog').showModal();
    };

    document.getElementById('pageModalForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const editId = document.getElementById('editPageId').value;
      const payload = {
        provider: document.getElementById('newPageProvider').value,
        categoryName: document.getElementById('newPageCategory').value,
        url: document.getElementById('newPageUrl').value,
        withOffers: document.getElementById('newPageWithOffers').checked,
        enabled: document.getElementById('newPageEnabled').checked,
      };

      const url = editId ? '/api/pages/' + encodeURIComponent(editId) : '/api/pages';
      const method = editId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast('Error: ' + (data.error || 'Could not save page'));
        return;
      }
      document.getElementById('pageFormDialog').close();
      showToast(editId ? 'Updated scraping page!' : 'Added scraping page: ' + data.page.categoryName);
      await fetchDashboard();
    });

    window.deletePage = async (id) => {
      await fetch('/api/pages/' + encodeURIComponent(id), { method: 'DELETE' });
      showToast('Deleted scraping page');
      await fetchDashboard();
    };

    // Edit Cron Modal
    document.getElementById('btnOpenCronDialog').addEventListener('click', () => {
      if (dashboardData?.scheduler) {
        document.getElementById('cronEnabledInput').checked = dashboardData.scheduler.enabled;
        document.getElementById('cronBaseTimeInput').value = dashboardData.scheduler.baseTime;
        document.getElementById('cronJitterInput').value = dashboardData.scheduler.jitterMinutes;
      }
      document.getElementById('cronFormDialog').showModal();
    });

    document.getElementById('schedulerForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        enabled: document.getElementById('cronEnabledInput').checked,
        baseTime: document.getElementById('cronBaseTimeInput').value,
        jitterMinutes: Number(document.getElementById('cronJitterInput').value),
      };
      const res = await fetch('/api/scheduler', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        document.getElementById('cronFormDialog').close();
        showToast('Saved randomized cron schedule to .env');
        await fetchDashboard();
      }
    });

    document.getElementById('btnRerollCron').addEventListener('click', async () => {
      await fetch('/api/scheduler', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reroll: true }),
      });
      showToast('Re-rolled random daily offset!');
      await fetchDashboard();
    });

    // Configuration View Mode vs Edit Mode toggle
    function setConfigEditMode(editing) {
      isConfigEditing = editing;
      document.getElementById('configViewMode').style.display = editing ? 'none' : 'block';
      document.getElementById('configEditMode').style.display = editing ? 'block' : 'none';
      document.getElementById('btnEnterConfigEdit').style.display = editing ? 'none' : 'inline-flex';
      if (editing && dashboardData) {
        renderEnvEditorFields(dashboardData.env);
      }
    }

    document.getElementById('btnEnterConfigEdit').addEventListener('click', () => setConfigEditMode(true));
    document.getElementById('btnCancelConfigEdit').addEventListener('click', () => setConfigEditMode(false));

    document.getElementById('btnToggleSecrets').addEventListener('click', () => {
      showSecrets = !showSecrets;
      document.getElementById('btnToggleSecrets').textContent = showSecrets ? '🙈 Hide Secrets' : '👁 Show Secrets';
      if (dashboardData) {
        renderConfigTable(dashboardData.env);
        if (isConfigEditing) renderEnvEditorFields(dashboardData.env);
      }
    });

    document.getElementById('btnSaveAllEnv').addEventListener('click', async () => {
      const updates = {};
      document.querySelectorAll('[data-env-key]').forEach((input) => {
        updates[input.dataset.envKey] = input.value;
      });
      const res = await fetch('/api/env', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });
      if (res.ok) {
        setConfigEditMode(false);
        showToast('Saved configuration to .env');
        await fetchDashboard();
      }
    });

    document.getElementById('addCustomEnvForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const key = document.getElementById('customEnvKey').value.trim();
      const val = document.getElementById('customEnvVal').value;
      if (!key) return;
      await fetch('/api/env', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: { [key]: val } }),
      });
      document.getElementById('customEnvKey').value = '';
      document.getElementById('customEnvVal').value = '';
      showToast('Added ' + key + ' to .env');
      await fetchDashboard();
      if (dashboardData) renderEnvEditorFields(dashboardData.env);
    });

    window.removeEnvKey = async (key) => {
      await fetch('/api/env/' + encodeURIComponent(key), { method: 'DELETE' });
      showToast('Removed ' + key + ' from .env');
      await fetchDashboard();
      if (dashboardData) renderEnvEditorFields(dashboardData.env);
    };

    // Email preview & test buttons
    async function openEmailPreview() {
      const res = await fetch('/api/email/preview');
      const data = await res.json();
      document.getElementById('emailPreviewSubject').textContent = 'Subject: ' + data.subject;
      const frame = document.getElementById('emailPreviewFrame');
      frame.srcdoc = data.html;
      document.getElementById('emailPreviewDialog').showModal();
    }

    document.getElementById('btnPreviewEmailConfig').addEventListener('click', openEmailPreview);

    document.getElementById('btnSendTestEmail').addEventListener('click', async () => {
      const res = await fetch('/api/email/test', { method: 'POST' });
      const data = await res.json();
      if (data.sent) {
        showToast('Test email sent via Resend! Message ID: ' + data.messageId);
      } else {
        showToast('Email not sent: ' + (data.error || data.reason));
      }
      await fetchDashboard();
    });

    fetchDashboard();
    setInterval(fetchDashboard, 2500);
  </script>
</body>
</html>`;
}
