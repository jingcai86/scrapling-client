export function renderHeader(): string {
  return `  <header class="app-header">
    <div class="header-inner">
      <div class="brand" onclick="switchTab('home')" style="cursor:pointer;" title="Go to Home">
        <div class="brand-badge">S</div>
        <div>
          <h1>Scrapling Monitor</h1>
          <p>Multi-Provider Scraper • Randomized Cron • Resend Alerts</p>
        </div>
      </div>

      <nav class="nav-tabs" aria-label="Main Navigation">
        <button type="button" class="tab-btn" data-tab="eneba" data-route="/eneba">🎮 Eneba Deals</button>
        <button type="button" class="tab-btn" data-tab="scraping" data-route="/scraping">⚡ Scraping &amp; Targets (<span id="navPagesCount">0</span>)</button>
        <button type="button" class="tab-btn" data-tab="config" data-route="/config">⚙️ Configuration</button>
      </nav>

      <div class="header-actions">
        <button type="button" class="theme-toggle-btn" id="themeToggleBtn" title="Switch theme (Light / Dark / System)" aria-label="Theme toggle">
          <span id="themeBtnIcon">🖥️</span>
          <span id="themeBtnLabel">Theme: System</span>
        </button>
      </div>
    </div>
  </header>`;
}

export function renderScrapeBanner(): string {
  return `    <div id="scrapeBanner" class="scrape-banner" role="status" aria-live="polite">
      <div style="display:flex;align-items:center;gap:0.85rem;">
        <div class="spinner"></div>
        <div>
          <div style="font-weight:700;font-size:0.92rem;" id="scrapeStepText">Scraping in progress...</div>
          <div style="font-size:0.8rem;color:var(--text-muted);" id="scrapeProgressSub">Connecting to Scrapling MCP...</div>
        </div>
      </div>
      <span class="badge badge-provider" id="scrapeProgressBadge">0 / 0</span>
    </div>`;
}

export function renderToast(): string {
  return `  <div id="toast" class="toast" role="status" aria-live="polite"></div>`;
}
