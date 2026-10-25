export function renderDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Scrapling Deal Monitor — Status, Pages, Cron & Alerts</title>
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
      background: rgba(30, 41, 59, 0.9);
      backdrop-filter: blur(8px);
      border-bottom: 1px solid var(--border);
      position: sticky;
      inset-block-start: 0;
      z-index: 20;
      padding: 1rem 1.5rem;
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
      font-size: 0.8rem;
      color: var(--text-muted);
    }

    .nav-tabs {
      display: flex;
      gap: 0.4rem;
      flex-wrap: wrap;
    }

    .tab-btn {
      background: transparent;
      color: var(--text-muted);
      border: 1px solid transparent;
      padding: 0.5rem 0.9rem;
      border-radius: 8px;
      font-size: 0.875rem;
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
      border-color: var(--primary);
    }

    .header-actions {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      flex-wrap: wrap;
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
      padding: 0.32rem 0.65rem;
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
      padding: 1rem 1.25rem;
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
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 1rem;
      margin-block-end: 1.5rem;
    }

    .kpi-card {
      background: var(--bg-panel);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 1.15rem 1.25rem;
    }

    .kpi-label {
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      font-weight: 600;
    }

    .kpi-value {
      font-size: 1.65rem;
      font-weight: 800;
      margin: 0.25rem 0;
    }

    .kpi-sub {
      font-size: 0.82rem;
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

    /* Modern Responsive Table (from modern-web-guidance: responsive-table) */
    .table-wrapper {
      overflow: auto;
      max-inline-size: 100%;
      max-block-size: min(620px, 80vh);
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
      padding: 0.75rem 1rem;
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
    }

    /* Form Controls & Deferred Validation (:user-invalid from modern-web-guidance) */
    .form-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 1rem;
    }

    .field {
      display: flex;
      flex-direction: column;
      margin-block-end: 0.85rem;
    }

    .field label {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--text);
      margin-block-end: 0.15rem;
    }

    .hint {
      display: block;
      color: var(--text-muted);
      font-size: 0.76rem;
      margin-block-end: 0.35rem;
    }

    input[type="text"],
    input[type="url"],
    input[type="email"],
    input[type="number"],
    input[type="time"],
    input[type="password"],
    select {
      padding: 0.55rem 0.75rem;
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
      max-height: 180px;
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
          <h1>Scrapling Deal Monitor</h1>
          <p>Multi-Provider Gift Card Scraper • Randomized Cron • Resend Alerts</p>
        </div>
      </div>

      <nav class="nav-tabs" aria-label="Dashboard Sections">
        <button type="button" class="tab-btn active" data-tab="overview">Home &amp; Best Deals</button>
        <button type="button" class="tab-btn" data-tab="pages">Scrape Pages (<span id="navPagesCount">0</span>)</button>
        <button type="button" class="tab-btn" data-tab="scheduler">Cron &amp; Email Alerts</button>
        <button type="button" class="tab-btn" data-tab="env">Environment (.env)</button>
      </nav>

      <div class="header-actions">
        <button type="button" class="btn btn-primary" id="btnScrapeAll">
          <span>▶ Scrape All Enabled</span>
        </button>
        <button type="button" class="btn" id="btnScrapeFast" title="Fast scrape without headless seller offer fetches">
          <span>⚡ Fast Scrape (No Offers)</span>
        </button>
        <button type="button" class="btn" id="btnPreviewEmailHeader">
          <span>✉ Preview Alert Email</span>
        </button>
      </div>
    </div>
  </header>

  <main class="container">
    <!-- Live Scrape Banner -->
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

    <!-- TAB 1: OVERVIEW & BEST DEALS -->
    <section id="tab-overview" class="tab-panel active">
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-label">Configured Scrape Pages</div>
          <div class="kpi-value" id="kpiPagesCount">—</div>
          <div class="kpi-sub" id="kpiProvidersSub">Provider: eneba</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Highest Effective Discount</div>
          <div class="kpi-value" style="color:#34d399;" id="kpiMaxDiscount">—</div>
          <div class="kpi-sub" id="kpiMaxDealTitle">Across all in-stock gift cards</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Randomized Daily Cron</div>
          <div class="kpi-value" style="font-size:1.25rem;" id="kpiNextCron">—</div>
          <div class="kpi-sub" id="kpiCronWindow">Base 19:00 + 0..60m random jitter</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Alert Rule &amp; Database</div>
          <div class="kpi-value" style="font-size:1.25rem;" id="kpiAlertThreshold">&ge; 20% Off</div>
          <div class="kpi-sub" id="kpiDbStatus">PostgreSQL schema: eneba</div>
        </div>
      </div>

      <!-- Cross-Category Status Table -->
      <div class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Category Status &amp; #1 Best Deal Summary</h2>
            <div style="font-size:0.82rem;color:var(--text-muted);">
              Live snapshot across all scraped gift card store pages
            </div>
          </div>
          <div style="display:flex;gap:0.5rem;align-items:center;">
            <label for="providerFilter" style="font-size:0.8rem;color:var(--text-muted);">Provider:</label>
            <select id="providerFilter">
              <option value="all">All Providers</option>
              <option value="eneba">Eneba</option>
            </select>
          </div>
        </div>

        <div tabindex="0" role="region" aria-labelledby="summary-table-caption" class="table-wrapper">
          <table style="--label-2:'In Stock';--label-3:'Avg Discount';--label-4:'Avg Effective';--label-5:'Best Deal on Page';--label-6:'Seller Offers';--label-7:'Updated';">
            <caption id="summary-table-caption">Category status and best deal comparison</caption>
            <thead>
              <tr>
                <th>Category</th>
                <th>In Stock</th>
                <th>Avg Discount</th>
                <th>Avg Effective (+CB)</th>
                <th>#1 Best Deal on Page</th>
                <th>Seller Offers</th>
                <th>Last Scraped</th>
              </tr>
            </thead>
            <tbody id="summaryTableBody">
              <tr><td colspan="7" style="color:var(--text-muted);text-align:center;">Loading status...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Top 10 Ranked Deals Explorer -->
      <div class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Top 10 Ranked Deals Per Page</h2>
            <div style="font-size:0.82rem;color:var(--text-muted);">
              Ranked 1–10 by effective discount % (direct discount + cashback). Deals meeting the alert threshold are highlighted.
            </div>
          </div>
          <div style="display:flex;gap:0.5rem;align-items:center;">
            <label for="categoryFilter" style="font-size:0.8rem;color:var(--text-muted);">Category:</label>
            <select id="categoryFilter">
              <option value="all">All Categories</option>
            </select>
          </div>
        </div>

        <div tabindex="0" role="region" aria-labelledby="deals-table-caption" class="table-wrapper">
          <table style="--label-2:'Category';--label-3:'Region';--label-4:'Price / Baseline';--label-5:'Direct Disc';--label-6:'Effective Disc';--label-7:'Action';">
            <caption id="deals-table-caption">Top ranked gift card deals</caption>
            <thead>
              <tr>
                <th>Rank &amp; Product</th>
                <th>Category</th>
                <th>Region</th>
                <th>Selling Price</th>
                <th>Direct Disc</th>
                <th>Effective (+CB)</th>
                <th>Link</th>
              </tr>
            </thead>
            <tbody id="dealsTableBody">
              <tr><td colspan="7" style="color:var(--text-muted);text-align:center;">Loading deals...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Recent Activity Log -->
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Live Scraper &amp; Persistence Logs</h2>
        </div>
        <div class="log-box" id="logBox">No recent logs yet.</div>
      </div>
    </section>

    <!-- TAB 2: SCRAPE PAGES MANAGER -->
    <section id="tab-pages" class="tab-panel">
      <div class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Configured Scraping Pages</h2>
            <div style="font-size:0.82rem;color:var(--text-muted);">
              Add, toggle, or delete store category pages to scrape. Default includes Eneba PlayStation, Nintendo, Android, Amazon, and Apple gift cards.
            </div>
          </div>
        </div>

        <div tabindex="0" role="region" aria-labelledby="pages-table-caption" class="table-wrapper">
          <table style="--label-2:'Provider';--label-3:'Store URL';--label-4:'Seller Offers';--label-5:'Status';--label-6:'Actions';">
            <caption id="pages-table-caption">Configured scraping pages</caption>
            <thead>
              <tr>
                <th>Category Name</th>
                <th>Provider</th>
                <th>Store Page URL</th>
                <th>Seller Offers</th>
                <th>Enabled</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="pagesTableBody"></tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Add New Scraping Page</h2>
        </div>
        <form id="addPageForm">
          <div class="form-grid">
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
              <span id="cat-hint" class="hint">Example: Steam Gift Cards or Xbox Gift Cards</span>
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
          </div>

          <div style="display:flex;align-items:center;gap:1.5rem;margin:0.5rem 0 1rem;">
            <label style="display:inline-flex;align-items:center;gap:0.5rem;font-size:0.875rem;cursor:pointer;">
              <input type="checkbox" id="newPageWithOffers" checked />
              Scrape competing third-party seller offers by default
            </label>
          </div>

          <button type="submit" class="btn btn-primary">+ Add Scraping Page</button>
        </form>
      </div>
    </section>

    <!-- TAB 3: RANDOMIZED CRON & RESEND EMAIL ALERTS -->
    <section id="tab-scheduler" class="tab-panel">
      <div class="form-grid">
        <!-- Randomized Cron Job Card -->
        <div class="card">
          <div class="card-header">
            <div>
              <h2 class="card-title">Randomized Daily Cron Scheduler</h2>
              <div style="font-size:0.82rem;color:var(--text-muted);">
                Runs daily starting from Base Time plus a random delay (0 to Jitter minutes), e.g., 7:00 PM + 0..60m = scrapes randomly between 7:00 PM and 8:00 PM.
              </div>
            </div>
          </div>

          <div style="background:var(--bg-panel-alt);border:1px solid var(--border);border-radius:10px;padding:1rem;margin-block-end:1rem;">
            <div style="font-size:0.8rem;color:var(--text-muted);">Next Scheduled Execution</div>
            <div style="font-size:1.1rem;font-weight:700;color:#818cf8;margin:0.2rem 0;" id="schedNextRunText">—</div>
            <div style="font-size:0.8rem;color:var(--text-muted);" id="schedOffsetText">—</div>
            <div style="font-size:0.78rem;color:var(--text-muted);margin-top:0.35rem;" id="schedLastRunText">Last run: idle</div>
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
              <span id="jitter-hint" class="hint">Random minutes (0–720) added to start time each day (default: 60 mins)</span>
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

            <div style="display:flex;gap:0.6rem;flex-wrap:wrap;margin-top:1rem;">
              <button type="submit" class="btn btn-primary">Save Schedule to .env</button>
              <button type="button" class="btn" id="btnRerollCron">🎲 Re-Roll Random Offset</button>
            </div>
          </form>
        </div>

        <!-- Resend Email Alert Card -->
        <div class="card">
          <div class="card-header">
            <div>
              <h2 class="card-title">Resend Email Deal Alerts</h2>
              <div style="font-size:0.82rem;color:var(--text-muted);">
                Automatically emails you via Resend whenever any scraped gift card meets or exceeds your discount threshold (default: 20% off).
              </div>
            </div>
          </div>

          <form id="emailSettingsForm">
            <div class="field">
              <label style="display:inline-flex;align-items:center;gap:0.5rem;cursor:pointer;">
                <input type="checkbox" id="emailEnabledInput" />
                Enable Automatic Deal Alert Emails (<code>EMAIL_ENABLED</code>)
              </label>
            </div>

            <div class="field">
              <label for="emailThresholdInput">Discount Alert Threshold % (<code>ALERT_DISCOUNT_THRESHOLD_PCT</code>)</label>
              <span id="thresh-hint" class="hint">Send email when direct or effective discount is &ge; this % (e.g., 20)</span>
              <input
                type="number"
                id="emailThresholdInput"
                min="1"
                max="99"
                step="0.5"
                required
                value="20"
                aria-describedby="thresh-hint"
                aria-errormessage="thresh-err"
              />
              <div id="thresh-err" class="error-msg">
                <span aria-hidden="true">❌</span> Please enter a threshold between 1% and 99%.
              </div>
            </div>

            <div class="field">
              <label for="emailToInput">Recipient Email Address (<code>ALERT_EMAIL_TO</code>)</label>
              <span id="emailto-hint" class="hint">Format: you@example.com</span>
              <input
                type="email"
                id="emailToInput"
                autocomplete="email"
                placeholder="you@example.com"
                aria-describedby="emailto-hint"
                aria-errormessage="emailto-err"
              />
              <div id="emailto-err" class="error-msg">
                <span aria-hidden="true">❌</span> Please enter a valid email address.
              </div>
            </div>

            <div class="field">
              <label for="emailFromInput">Sender Address (<code>ALERT_EMAIL_FROM</code>)</label>
              <span id="emailfrom-hint" class="hint">Default Resend test sender: Deal Alerts &lt;onboarding@resend.dev&gt;</span>
              <input
                type="text"
                id="emailFromInput"
                value="Deal Alerts <onboarding@resend.dev>"
                aria-describedby="emailfrom-hint"
              />
            </div>

            <div class="field">
              <label for="resendKeyInput">Resend API Key (<code>RESEND_API_KEY</code>)</label>
              <span id="resendkey-hint" class="hint">Starts with re_... (saved directly to your local .env)</span>
              <input
                type="password"
                id="resendKeyInput"
                placeholder="re_xxxxxxxxxxxxxxxxx"
                aria-describedby="resendkey-hint"
              />
            </div>

            <div style="display:flex;gap:0.6rem;flex-wrap:wrap;margin-top:1rem;">
              <button type="submit" class="btn btn-primary">Save Email Config to .env</button>
              <button type="button" class="btn" id="btnPreviewEmailCard">✉ Preview Email Template</button>
              <button type="button" class="btn btn-success" id="btnSendTestEmail">🚀 Send Test Email</button>
            </div>
          </form>
        </div>
      </div>
    </section>

    <!-- TAB 4: ENVIRONMENT (.ENV) CONFIGURATION -->
    <section id="tab-env" class="tab-panel">
      <div class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Environment Configuration (<code>.env</code>)</h2>
            <div style="font-size:0.82rem;color:var(--text-muted);">
              File path: <code id="envFilePathLabel">.env</code> — Changes are written directly to disk and applied in memory immediately.
            </div>
          </div>
          <div style="display:flex;gap:0.5rem;">
            <button type="button" class="btn" id="btnToggleSecrets">👁 Show/Hide Secrets</button>
            <button type="button" class="btn btn-primary" id="btnSaveAllEnv">💾 Save All .env Changes</button>
          </div>
        </div>

        <form id="envEditorForm">
          <div id="envFieldsContainer" class="form-grid"></div>
        </form>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Add Custom Environment Variable</h2>
        </div>
        <form id="addCustomEnvForm" style="display:flex;gap:0.75rem;flex-wrap:wrap;align-items:flex-end;">
          <div class="field" style="flex:1;min-width:220px;margin:0;">
            <label for="customEnvKey">Variable Name</label>
            <span id="customkey-hint" class="hint">Example: CUSTOM_PROXY_URL</span>
            <input type="text" id="customEnvKey" placeholder="CUSTOM_KEY" required aria-describedby="customkey-hint" />
          </div>
          <div class="field" style="flex:2;min-width:280px;margin:0;">
            <label for="customEnvVal">Value</label>
            <span id="customval-hint" class="hint">Value to store in .env</span>
            <input type="text" id="customEnvVal" placeholder="value" aria-describedby="customval-hint" />
          </div>
          <button type="submit" class="btn btn-primary">+ Add Variable</button>
        </form>
      </div>
    </section>
  </main>

  <!-- Light-Dismiss Dialog 1: Email Alert Template Preview -->
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

  <!-- Light-Dismiss Dialog 2: Competing Seller Offers -->
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
        <table style="--label-2:'Price';--label-3:'Cashback';--label-4:'Rating';--label-5:'Badge';--label-6:'Store Link';">
          <caption id="offers-modal-caption">Competing seller offers for selected product</caption>
          <thead>
            <tr>
              <th>Seller / Merchant</th>
              <th>Price</th>
              <th>Cashback</th>
              <th>Rating</th>
              <th>Placement</th>
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
    // (from modern-web-guidance: light-dismiss-a-dialog)
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
    // (from modern-web-guidance: validate-input-after-interaction)
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

    // Dashboard State & Logic
    let dashboardData = null;
    let showSecrets = false;

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

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
      });
    });

    async function fetchDashboard() {
      const res = await fetch('/api/dashboard');
      dashboardData = await res.json();
      renderAll();
    }

    function renderAll() {
      if (!dashboardData) return;
      const { pages, statuses, runner, scheduler, env } = dashboardData;
      const thresholdPct = Number(env.values.ALERT_DISCOUNT_THRESHOLD_PCT || 20);

      // Update Nav count & KPIs
      document.getElementById('navPagesCount').textContent = pages.length;
      const enabledCount = pages.filter((p) => p.enabled).length;
      document.getElementById('kpiPagesCount').textContent = enabledCount + ' / ' + pages.length + ' Active';
      const providers = Array.from(new Set(pages.map((p) => p.provider)));
      document.getElementById('kpiProvidersSub').textContent = 'Providers: ' + (providers.join(', ') || 'eneba');

      // Highest discount KPI
      let maxDisc = 0;
      let maxDealTitle = 'No deals scraped yet';
      statuses.forEach((st) => {
        const best = st.bestEffectiveDeal || st.bestDeal;
        if (best && best.effectiveDiscountPct >= maxDisc) {
          maxDisc = best.effectiveDiscountPct;
          maxDealTitle = best.title + ' ($' + (best.sellingPrice?.toFixed(2) ?? 'N/A') + ')';
        }
      });
      document.getElementById('kpiMaxDiscount').textContent = maxDisc > 0 ? '-' + maxDisc.toFixed(2) + '%' : '0.00%';
      document.getElementById('kpiMaxDealTitle').textContent = maxDealTitle;

      // Scheduler KPI & Tab
      if (scheduler.enabled && scheduler.nextRunAt) {
        const nextDate = new Date(scheduler.nextRunAt);
        document.getElementById('kpiNextCron').textContent = nextDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        document.getElementById('kpiCronWindow').textContent =
          'Base ' + scheduler.baseTime + ' + ' + scheduler.chosenOffsetMinutes + 'm ' + scheduler.chosenOffsetSeconds + 's random jitter';
        document.getElementById('schedNextRunText').textContent = nextDate.toLocaleString();
        document.getElementById('schedOffsetText').textContent =
          'Window: ' + scheduler.baseTime + ' + [0..' + scheduler.jitterMinutes + 'm] → Rolled offset: +' +
          scheduler.chosenOffsetMinutes + 'm ' + scheduler.chosenOffsetSeconds + 's';
      } else {
        document.getElementById('kpiNextCron').textContent = 'Disabled';
        document.getElementById('kpiCronWindow').textContent = 'Enable in Cron & Email Alerts tab';
        document.getElementById('schedNextRunText').textContent = 'Cron Disabled';
        document.getElementById('schedOffsetText').textContent = '';
      }
      document.getElementById('schedLastRunText').textContent =
        'Last scheduled run: ' + (scheduler.lastRunAt ? new Date(scheduler.lastRunAt).toLocaleString() + ' (' + scheduler.lastRunStatus + ')' : 'Never run yet');

      // Alert & DB KPI
      document.getElementById('kpiAlertThreshold').textContent = '≥ ' + thresholdPct + '% Off';
      const emailActive = String(env.values.EMAIL_ENABLED).toLowerCase() === 'true';
      document.getElementById('kpiDbStatus').textContent =
        'Email Alerts: ' + (emailActive ? 'Enabled' : 'Standby') + ' • DB: ' + (env.values.DATABASE_URL ? 'Configured' : 'Optional');

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

      // Render Summary Table
      const summaryBody = document.getElementById('summaryTableBody');
      if (statuses.length === 0) {
        summaryBody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);">No scrape results yet. Click "Scrape All Enabled" above to fetch live deals.</td></tr>';
      } else {
        summaryBody.innerHTML = statuses.map((st, idx) => {
          const best = st.bestEffectiveDeal || st.bestDeal;
          const offersCount = st.bestDealOffers ? st.bestDealOffers.length : 0;
          const bestHtml = best
            ? '<a href="' + escapeHtml(best.url) + '" target="_blank" rel="noopener"><strong>-' +
              best.effectiveDiscountPct.toFixed(2) + '% ($' + (best.sellingPrice?.toFixed(2) ?? 'N/A') + ')</strong> — ' +
              escapeHtml(best.title) + '</a>'
            : '<span style="color:var(--text-muted);">None in stock</span>';

          return '<tr>' +
            '<th><span class="badge badge-provider" style="margin-right:6px;">eneba</span>' + escapeHtml(st.category) + '</th>' +
            '<td>' + st.inStockCount + ' / ' + st.totalListings + '</td>' +
            '<td>' + st.averageDiscountPctOnDiscounted.toFixed(2) + '%</td>' +
            '<td><span class="badge badge-discount">' + st.averageEffectiveDiscountPct.toFixed(2) + '%</span></td>' +
            '<td>' + bestHtml + '</td>' +
            '<td>' + (offersCount > 0
              ? '<button type="button" class="btn btn-sm" onclick="openSellerOffers(' + idx + ')">View ' + offersCount + ' Sellers</button>'
              : '<span style="color:var(--text-muted);">0 offers</span>') + '</td>' +
            '<td style="color:var(--text-muted);font-size:0.8rem;">' + new Date(st.scrapedAt).toLocaleString() + '</td>' +
          '</tr>';
        }).join('');
      }

      // Populate Category Filter & Render Top 10 Deals Table
      const catSelect = document.getElementById('categoryFilter');
      const currentCat = catSelect.value;
      const categories = statuses.map((s) => s.category);
      catSelect.innerHTML = '<option value="all">All Categories (' + statuses.length + ')</option>' +
        categories.map((c) => '<option value="' + escapeHtml(c) + '"' + (c === currentCat ? ' selected' : '') + '>' + escapeHtml(c) + '</option>').join('');

      renderDealsTable(statuses, catSelect.value, thresholdPct);

      // Render Logs
      const logBox = document.getElementById('logBox');
      logBox.innerHTML = (runner.recentLogs && runner.recentLogs.length > 0)
        ? runner.recentLogs.map((l) => '<div>' + escapeHtml(l) + '</div>').join('')
        : 'Ready. Waiting for scrape actions.';

      // Render Pages Manager Table
      const pagesBody = document.getElementById('pagesTableBody');
      pagesBody.innerHTML = pages.map((p) => {
        return '<tr>' +
          '<th>' + escapeHtml(p.categoryName) + '</th>' +
          '<td><span class="badge badge-provider">' + escapeHtml(p.provider) + '</span></td>' +
          '<td><a href="' + escapeHtml(p.url) + '" target="_blank" rel="noopener">' + escapeHtml(p.url) + '</a></td>' +
          '<td><input type="checkbox" ' + (p.withOffers ? 'checked' : '') + ' onchange="togglePageField(\\'' + escapeHtml(p.id) + '\\', \\'withOffers\\', this.checked)" /></td>' +
          '<td><input type="checkbox" ' + (p.enabled ? 'checked' : '') + ' onchange="togglePageField(\\'' + escapeHtml(p.id) + '\\', \\'enabled\\', this.checked)" /></td>' +
          '<td style="display:flex;gap:0.4rem;flex-wrap:wrap;">' +
            '<button type="button" class="btn btn-sm btn-primary" onclick="scrapeSinglePage(\\'' + escapeHtml(p.id) + '\\')">▶ Scrape</button>' +
            '<button type="button" class="btn btn-sm btn-danger" onclick="deletePage(\\'' + escapeHtml(p.id) + '\\')">Delete</button>' +
          '</td>' +
        '</tr>';
      }).join('');

      // Sync Scheduler & Email form inputs if not currently focused
      if (document.activeElement?.id !== 'cronBaseTimeInput' && document.activeElement?.id !== 'cronJitterInput') {
        document.getElementById('cronEnabledInput').checked = scheduler.enabled;
        document.getElementById('cronBaseTimeInput').value = scheduler.baseTime;
        document.getElementById('cronJitterInput').value = scheduler.jitterMinutes;
      }

      if (!document.getElementById('emailSettingsForm').contains(document.activeElement)) {
        document.getElementById('emailEnabledInput').checked = String(env.values.EMAIL_ENABLED).toLowerCase() === 'true';
        document.getElementById('emailThresholdInput').value = env.values.ALERT_DISCOUNT_THRESHOLD_PCT || '20';
        document.getElementById('emailToInput').value = env.values.ALERT_EMAIL_TO || '';
        document.getElementById('emailFromInput').value = env.values.ALERT_EMAIL_FROM || 'Deal Alerts <onboarding@resend.dev>';
        document.getElementById('resendKeyInput').value = env.values.RESEND_API_KEY || '';
      }

      // Render .env Editor if not currently editing inside it
      if (!document.getElementById('envEditorForm').contains(document.activeElement)) {
        renderEnvEditor(env);
      }
    }

    function renderDealsTable(statuses, selectedCategory, thresholdPct) {
      const dealsBody = document.getElementById('dealsTableBody');
      const filteredStatuses = selectedCategory === 'all'
        ? statuses
        : statuses.filter((s) => s.category === selectedCategory);

      const rows = [];
      filteredStatuses.forEach((st) => {
        (st.rankedDeals || []).slice(0, 10).forEach((deal, idx) => {
          const rank = idx + 1;
          const baseline = deal.originalPrice ?? deal.faceValue;
          const isAlertMatch = Math.max(deal.discountPct, deal.effectiveDiscountPct) >= thresholdPct;
          rows.push(
            '<tr>' +
              '<th>#' + rank + ' — ' + escapeHtml(deal.title) +
                (isAlertMatch ? ' <span class="badge badge-alert" title="Meets email alert threshold">🔥 &ge;' + thresholdPct + '%</span>' : '') +
              '</th>' +
              '<td>' + escapeHtml(st.category) + '</td>' +
              '<td>' + escapeHtml(deal.region) + '</td>' +
              '<td><strong>$' + (deal.sellingPrice?.toFixed(2) ?? 'N/A') + '</strong>' +
                (baseline ? ' <span style="color:var(--text-muted);text-decoration:line-through;font-size:0.78rem;">$' + baseline.toFixed(2) + '</span>' : '') +
              '</td>' +
              '<td>-' + deal.discountPct.toFixed(2) + '%</td>' +
              '<td><span class="badge badge-discount">-' + deal.effectiveDiscountPct.toFixed(2) + '%</span>' +
                (deal.cashbackPct > 0 ? ' <span style="font-size:0.75rem;color:var(--text-muted);">(+' + deal.cashbackPct.toFixed(1) + '% CB → $' + (deal.effectivePrice?.toFixed(2) ?? '') + ')</span>' : '') +
              '</td>' +
              '<td><a href="' + escapeHtml(deal.url) + '" target="_blank" rel="noopener" class="btn btn-sm">Open Deal ↗</a></td>' +
            '</tr>'
          );
        });
      });

      dealsBody.innerHTML = rows.length > 0
        ? rows.join('')
        : '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);">No ranked deals to display.</td></tr>';
    }

    function renderEnvEditor(env) {
      document.getElementById('envFilePathLabel').textContent = env.envFilePath || '.env';
      const container = document.getElementById('envFieldsContainer');
      const schemaByKey = new Map((env.schema || []).map((f) => [f.key, f]));
      const allKeys = Array.from(new Set([...schemaByKey.keys(), ...Object.keys(env.values || {})]));

      container.innerHTML = allKeys.map((key) => {
        const meta = schemaByKey.get(key);
        const val = env.values[key] ?? '';
        const isSecret = meta?.isSecret || /PASSWORD|SECRET|KEY|DATABASE_URL/i.test(key);
        const inputType = isSecret && !showSecrets ? 'password' : 'text';
        const desc = meta ? meta.description : 'Custom environment variable';

        return '<div class="field" style="background:var(--bg-panel-alt);padding:0.85rem;border:1px solid var(--border);border-radius:10px;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;">' +
            '<label for="env_' + escapeHtml(key) + '"><code>' + escapeHtml(key) + '</code></label>' +
            (!meta ? '<button type="button" class="btn btn-sm btn-danger" onclick="removeEnvKey(\\'' + escapeHtml(key) + '\\')">Remove</button>' : '<span class="badge badge-muted">' + escapeHtml(meta.group) + '</span>') +
          '</div>' +
          '<span id="hint_' + escapeHtml(key) + '" class="hint">' + escapeHtml(desc) + '</span>' +
          '<input type="' + inputType + '" id="env_' + escapeHtml(key) + '" data-env-key="' + escapeHtml(key) + '" value="' + escapeHtml(val) + '" aria-describedby="hint_' + escapeHtml(key) + '" />' +
        '</div>';
      }).join('');
    }

    document.getElementById('categoryFilter').addEventListener('change', (e) => {
      if (!dashboardData) return;
      const thresholdPct = Number(dashboardData.env.values.ALERT_DISCOUNT_THRESHOLD_PCT || 20);
      renderDealsTable(dashboardData.statuses, e.target.value, thresholdPct);
    });

    // Open competing seller offers modal
    window.openSellerOffers = (statusIdx) => {
      const st = dashboardData?.statuses?.[statusIdx];
      if (!st) return;
      const best = st.bestEffectiveDeal || st.bestDeal;
      document.getElementById('sellerOffersSub').textContent =
        (best ? best.title : st.category) + ' — ' + (st.bestDealOffers?.length || 0) + ' competing merchant offers';
      const tbody = document.getElementById('sellerOffersBody');
      tbody.innerHTML = (st.bestDealOffers || []).map((o) => {
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
      document.getElementById('sellerOffersDialog').showModal();
    };

    // Scrape triggers
    async function triggerScrape(payload) {
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
    }

    document.getElementById('btnScrapeAll').addEventListener('click', () => triggerScrape({}));
    document.getElementById('btnScrapeFast').addEventListener('click', () => triggerScrape({ withOffers: false }));
    window.scrapeSinglePage = (pageId) => triggerScrape({ pageId });

    // Page Store CRUD
    document.getElementById('addPageForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        provider: document.getElementById('newPageProvider').value,
        categoryName: document.getElementById('newPageCategory').value,
        url: document.getElementById('newPageUrl').value,
        withOffers: document.getElementById('newPageWithOffers').checked,
      };
      const res = await fetch('/api/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast('Error: ' + (data.error || 'Could not add page'));
        return;
      }
      document.getElementById('newPageCategory').value = '';
      document.getElementById('newPageUrl').value = '';
      showToast('Added scraping page: ' + data.page.categoryName);
      await fetchDashboard();
    });

    window.togglePageField = async (id, field, value) => {
      await fetch('/api/pages/' + encodeURIComponent(id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      showToast('Updated page setting (' + field + ')');
      await fetchDashboard();
    };

    window.deletePage = async (id) => {
      await fetch('/api/pages/' + encodeURIComponent(id), { method: 'DELETE' });
      showToast('Deleted scraping page');
      await fetchDashboard();
    };

    // Scheduler form
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

    // Email settings form
    document.getElementById('emailSettingsForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const updates = {
        EMAIL_ENABLED: String(document.getElementById('emailEnabledInput').checked),
        ALERT_DISCOUNT_THRESHOLD_PCT: document.getElementById('emailThresholdInput').value,
        ALERT_EMAIL_TO: document.getElementById('emailToInput').value,
        ALERT_EMAIL_FROM: document.getElementById('emailFromInput').value,
        RESEND_API_KEY: document.getElementById('resendKeyInput').value,
      };
      await fetch('/api/env', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });
      showToast('Saved Resend email alert settings to .env');
      await fetchDashboard();
    });

    // Email preview modal
    async function openEmailPreview() {
      const res = await fetch('/api/email/preview');
      const data = await res.json();
      document.getElementById('emailPreviewSubject').textContent = 'Subject: ' + data.subject;
      const frame = document.getElementById('emailPreviewFrame');
      frame.srcdoc = data.html;
      document.getElementById('emailPreviewDialog').showModal();
    }

    document.getElementById('btnPreviewEmailHeader').addEventListener('click', openEmailPreview);
    document.getElementById('btnPreviewEmailCard').addEventListener('click', openEmailPreview);

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

    // .env Editor save & secrets toggle
    document.getElementById('btnToggleSecrets').addEventListener('click', () => {
      showSecrets = !showSecrets;
      if (dashboardData) renderEnvEditor(dashboardData.env);
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
        showToast('Saved all configuration variables to .env');
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
    });

    window.removeEnvKey = async (key) => {
      await fetch('/api/env/' + encodeURIComponent(key), { method: 'DELETE' });
      showToast('Removed ' + key + ' from .env');
      await fetchDashboard();
    };

    // Poll every 2.5s so live scrape progress and cron countdown stay up-to-date
    fetchDashboard();
    setInterval(fetchDashboard, 2500);
  </script>
</body>
</html>`;
}
