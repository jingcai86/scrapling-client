export function renderEnebaTab(): string {
  return `    <section id="tab-eneba" class="tab-panel">
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
          <div class="kpi-label">Best Eneba Deal</div>
          <div class="kpi-value" style="color:#34d399;" id="enebaKpiBestPct">—</div>
          <div class="kpi-sub" id="enebaKpiBestTitle">—</div>
        </div>
      </div>

      <!-- Eneba Provider Action Bar & Modal Trigger -->
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem;margin-block-end:1.25rem;">
        <div style="display:flex;align-items:center;gap:0.6rem;font-size:0.85rem;color:var(--text-muted);">
          <span class="badge badge-discount" style="font-size:0.75rem;">scrapling.eneba_config</span>
          <span>Pull Limit: <strong id="enebaPullLimitBadge">10</strong> • Alert Threshold: <strong id="enebaAlertThreshBadge">20%</strong></span>
        </div>
        <div style="display:flex;gap:0.75rem;">
          <button type="button" class="btn btn-sm" id="btnOpenEnebaConfigModal">
            ⚙️ Scraper Configuration
          </button>
          <button type="button" class="btn btn-sm btn-primary" onclick="triggerScrape({})">
            ▶ Scrape Now
          </button>
        </div>
      </div>

      <!-- Eneba Configuration Modal Dialog -->
      <dialog id="enebaConfigModal" closedby="any" aria-labelledby="enebaModalTitle" class="modal-dialog eneba-config-dialog">
        <div class="dialog-inner" style="padding:1.5rem 1.75rem;">
          <div class="dialog-header" style="margin-block-end:1.25rem;">
            <div>
              <h3 id="enebaModalTitle" style="margin:0;font-size:1.15rem;font-weight:700;display:flex;align-items:center;gap:0.5rem;">
                <span>⚙️ Eneba Scraper &amp; Alert Configuration</span>
                <span class="badge badge-discount" style="font-size:0.75rem;">scrapling.eneba_config</span>
              </h3>
              <p style="margin:0.35rem 0 0;font-size:0.83rem;color:var(--text-muted);line-height:1.4;">
                Configure how many top deals to pull per category and the minimum discount % to trigger alerts.
              </p>
            </div>
            <form method="dialog" style="margin:0;">
              <button type="submit" class="btn btn-sm" aria-label="Close dialog">✕ Close</button>
            </form>
          </div>

          <div style="display:flex;flex-direction:column;gap:1.25rem;padding:0.25rem 0 1.25rem;">
            <div class="field" style="margin-block-end:0;">
              <label for="enebaTopDealsLimitInput" style="font-weight:600;font-size:0.88rem;margin-bottom:0.25rem;">
                Pull Limit (Top Deals per Category)
              </label>
              <span class="hint" style="margin-bottom:0.4rem;">Range: 1–50 (default: 10). Persists top-ranked deals per category to PostgreSQL.</span>
              <input
                type="number"
                id="enebaTopDealsLimitInput"
                min="1"
                max="50"
                step="1"
                value="10"
                required
                style="width:100%;box-sizing:border-box;"
                aria-label="Number of top deals to pull per category"
              />
            </div>

            <div class="field" style="margin-block-end:0;">
              <label for="enebaAlertThresholdInput" style="font-weight:600;font-size:0.88rem;margin-bottom:0.25rem;">
                Alert Threshold (%)
              </label>
              <span class="hint" style="margin-bottom:0.4rem;">Minimum discount % to trigger alert emails (default: 20%).</span>
              <input
                type="number"
                id="enebaAlertThresholdInput"
                min="0"
                max="100"
                step="1"
                value="20"
                required
                style="width:100%;box-sizing:border-box;"
                aria-label="Minimum discount percent to trigger alert email"
              />
            </div>
          </div>

          <div style="display:flex;justify-content:flex-end;gap:0.65rem;padding-top:1rem;border-top:1px solid var(--border);">
            <form method="dialog" style="display:inline;margin:0;">
              <button type="submit" class="btn btn-sm">Cancel</button>
            </form>
            <button type="button" class="btn btn-sm btn-primary" id="btnSaveEnebaConfig">
              Save Configuration
            </button>
          </div>
        </div>
      </dialog>

      <!-- Eneba Table 1: Category Status & Competing Seller Offers (Sortable) -->
      <div class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Eneba Gift Card Categories — Status &amp; Seller Offers</h2>
            <div style="font-size:0.8rem;color:var(--text-muted);">
              Eneba-specific metrics including discount percentages and competing third-party merchant offers. Click any header to sort.
            </div>
          </div>
          <div style="display:flex;gap:0.5rem;">
            <button type="button" class="btn btn-sm btn-primary" onclick="triggerScrape({})">▶ Scrape Eneba Pages</button>
          </div>
        </div>

        <div tabindex="0" role="region" aria-labelledby="eneba-summary-caption" class="table-wrapper">
          <table id="enebaSummaryTable" style="--label-2:'In Stock';--label-3:'Avg Discount';--label-4:'#1 Best Deal on Page';--label-5:'Competing Sellers';--label-6:'Last Scraped';">
            <caption id="eneba-summary-caption">Eneba category status and competing seller offers</caption>
            <thead>
              <tr>
                <th class="sortable" data-table="enebaSummary" data-sort-key="category" aria-sort="none">Eneba Category <span class="sort-icon">↕</span></th>
                <th class="sortable" data-table="enebaSummary" data-sort-key="inStockCount" aria-sort="none">In Stock <span class="sort-icon">↕</span></th>
                <th class="sortable" data-table="enebaSummary" data-sort-key="avgDirect" aria-sort="descending">Avg Discount <span class="sort-icon">↓</span></th>
                <th class="sortable" data-table="enebaSummary" data-sort-key="bestEffective" aria-sort="none">#1 Best Deal on Page <span class="sort-icon">↕</span></th>
                <th class="sortable" data-table="enebaSummary" data-sort-key="offersCount" aria-sort="none">Competing Sellers <span class="sort-icon">↕</span></th>
                <th class="sortable" data-table="enebaSummary" data-sort-key="scrapedAt" aria-sort="none">Last Scraped <span class="sort-icon">↕</span></th>
              </tr>
            </thead>
            <tbody id="enebaSummaryBody">
              <tr><td colspan="6" style="color:var(--text-muted);text-align:center;">Loading Eneba categories...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Eneba Table 2: Eneba Top Ranked Deals Across Monitored Categories (Sortable) -->
      <div class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Eneba Top <span id="enebaTableLimitTitle">10</span> Ranked Gift Card Deals</h2>
            <div style="font-size:0.8rem;color:var(--text-muted);">
              The top <span id="enebaTableLimitSub">10</span> highest discount deals across monitored categories. Click any column header to sort.
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
          <table id="enebaDealsTable" style="--label-2:'Product Title';--label-3:'Category';--label-4:'Region';--label-5:'Selling Price';--label-6:'Discount %';--label-7:'Scraped At';--label-8:'Action';">
            <caption id="eneba-deals-caption">Eneba top 10 ranked gift card deals</caption>
            <thead>
              <tr>
                <th class="sortable" data-table="enebaDeals" data-sort-key="rank" aria-sort="none">Rank <span class="sort-icon">↕</span></th>
                <th class="sortable" data-table="enebaDeals" data-sort-key="title" aria-sort="none">Product Title <span class="sort-icon">↕</span></th>
                <th class="sortable" data-table="enebaDeals" data-sort-key="category" aria-sort="none">Category <span class="sort-icon">↕</span></th>
                <th class="sortable" data-table="enebaDeals" data-sort-key="region" aria-sort="none">Region <span class="sort-icon">↕</span></th>
                <th class="sortable" data-table="enebaDeals" data-sort-key="sellingPrice" aria-sort="none">Selling Price <span class="sort-icon">↕</span></th>
                <th class="sortable" data-table="enebaDeals" data-sort-key="discountPct" aria-sort="descending">Discount % <span class="sort-icon">↓</span></th>
                <th class="sortable" data-table="enebaDeals" data-sort-key="scrapedAt" aria-sort="none">Scraped At <span class="sort-icon">↕</span></th>
                <th>Eneba Link</th>
              </tr>
            </thead>
            <tbody id="enebaDealsBody">
              <tr><td colspan="8" style="color:var(--text-muted);text-align:center;">Loading Eneba deals...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>`;
}
