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
    </section>`;
}
