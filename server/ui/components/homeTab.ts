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
