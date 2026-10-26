export function renderScrapingTab(): string {
  return `    <section id="tab-scraping" class="tab-panel">
      <!-- 1. Scheduled Actions & Live Console -->
      <div class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Scheduled Actions &amp; Live Execution Console</h2>
            <div style="font-size:0.8rem;color:var(--text-muted);">
              Trigger an immediate scrape across all enabled pages or run automated scheduled executions.
            </div>
          </div>
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
            <button type="button" class="btn btn-primary" id="btnScrapeAll">
              <span>▶ Full Scrape (+ Seller Details)</span>
            </button>
            <button type="button" class="btn" id="btnScrapeFast">
              <span>⚡ Fast Scrape (Catalog Only)</span>
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
          <table id="pagesTable" style="--label-2:'Provider';--label-3:'Store URL';--label-4:'Seller Details';--label-5:'Status';--label-6:'Actions';">
            <caption id="pages-table-caption">Configured scraping pages</caption>
            <thead>
              <tr>
                <th class="sortable" data-table="pages" data-sort-key="categoryName" aria-sort="ascending">Category Name <span class="sort-icon">↑</span></th>
                <th class="sortable" data-table="pages" data-sort-key="provider" aria-sort="none">Provider <span class="sort-icon">↕</span></th>
                <th class="sortable" data-table="pages" data-sort-key="url" aria-sort="none">Store Page URL <span class="sort-icon">↕</span></th>
                <th class="sortable" data-table="pages" data-sort-key="withOffers" aria-sort="none">Seller Details <span class="sort-icon">↕</span></th>
                <th class="sortable" data-table="pages" data-sort-key="enabled" aria-sort="none">Status <span class="sort-icon">↕</span></th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="pagesTableBody"></tbody>
          </table>
        </div>
      </div>
    </section>`;
}
