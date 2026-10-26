export function renderHomeTab(): string {
  return `    <section id="tab-home" class="tab-panel active">
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

      <!-- Home Chart: Scraping Success Rate Over Time (Line Chart) -->
      <div class="card" style="margin-block-end:1.25rem;">
        <div class="card-header" style="flex-wrap:wrap;gap:1rem;">
          <div>
            <h2 class="card-title" style="display:flex;align-items:center;gap:0.5rem;">
              <span>📈 Scraping Success Rate Over Time</span>
            </h2>
            <div style="font-size:0.8rem;color:var(--text-muted);">
              Real-time trend line of page extraction success rate (0% – 100%) across scheduled and manual runs.
            </div>
          </div>
          <div style="display:flex;gap:0.75rem;align-items:center;flex-wrap:wrap;">
            <div style="font-size:0.82rem;background:var(--bg-panel-alt);padding:0.3rem 0.65rem;border-radius:6px;border:1px solid var(--border);">
              <span style="color:var(--text-muted);">Avg Success:</span>
              <strong id="chartAvgSuccessRate" style="color:#34d399;margin-inline-start:0.35rem;">100%</strong>
            </div>
            <div style="font-size:0.82rem;background:var(--bg-panel-alt);padding:0.3rem 0.65rem;border-radius:6px;border:1px solid var(--border);">
              <span style="color:var(--text-muted);">Total Runs:</span>
              <strong id="chartTotalRuns" style="margin-inline-start:0.35rem;">0</strong>
            </div>
          </div>
        </div>

        <div style="padding:0.5rem 1rem 1rem;">
          <div id="chartTooltipBar" style="display:none;font-size:0.82rem;padding:0.4rem 0.75rem;border-radius:6px;background:var(--bg-panel-alt);margin-block-end:0.75rem;border:1px solid var(--border);"></div>
          <div id="scrapeSuccessChartContainer" style="width:100%;height:260px;position:relative;">
            <!-- SVG rendered dynamically by renderScrapeSuccessChart -->
          </div>
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
    </section>`;
}
