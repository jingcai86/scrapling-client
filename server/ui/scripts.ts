export function renderClientScripts(): string {
  return `  <script>
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
      enebaSummary: { key: 'avgDirect', dir: 'desc' },
      enebaDeals: { key: 'discountPct', dir: 'desc' },
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
    let previousActiveTab = 'home';
    window.switchTab = (tabName, pushUrl = true) => {
      if (tabName === 'config') {
        const modal = document.getElementById('configModal');
        if (modal) {
          if (!modal.open) modal.showModal();
          if (pushUrl && window.location.pathname !== '/config') {
            window.history.pushState({ tab: 'config' }, '', '/config');
          }
          return;
        }
      }

      previousActiveTab = tabName;
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

    const configModalEl = document.getElementById('configModal');
    if (configModalEl) {
      configModalEl.addEventListener('close', () => {
        if (window.location.pathname === '/config') {
          const prevBtn = document.querySelector('.tab-btn[data-tab="' + previousActiveTab + '"]');
          const route = prevBtn?.dataset?.route || '/';
          window.history.pushState({ tab: previousActiveTab }, '', route);
          switchTab(previousActiveTab, false);
        }
      });
    }

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
        const now = new Date();
        const isToday = nextDate.toDateString() === now.toDateString();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const isTomorrow = nextDate.toDateString() === tomorrow.toDateString();
        const timeStr = nextDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateStr = nextDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
        let cronLabel = dateStr + ', ' + timeStr;
        if (isTomorrow) cronLabel = 'Tomorrow (' + dateStr + '), ' + timeStr;
        else if (isToday) cronLabel = 'Today (' + dateStr + '), ' + timeStr;

        document.getElementById('kpiNextCron').textContent = cronLabel;
        document.getElementById('kpiCronWindow').textContent =
          'Base ' + scheduler.baseTime + ' + ' + scheduler.chosenOffsetMinutes + 'm ' + scheduler.chosenOffsetSeconds + 's jitter';
        document.getElementById('viewCronEnabled').innerHTML = '<span class="badge badge-discount">Enabled</span>';
        document.getElementById('viewCronWindow').textContent = scheduler.baseTime + ' + [0..' + scheduler.jitterMinutes + ' mins]';
        document.getElementById('viewCronOffset').textContent = '+' + scheduler.chosenOffsetMinutes + 'm ' + scheduler.chosenOffsetSeconds + 's';
        document.getElementById('viewCronNext').textContent = cronLabel;
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
      renderScrapeSuccessChart(dashboardData?.history || [], statuses);

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

    // HOME LINE CHART: Scraping Success Rate Over Time
    function renderScrapeSuccessChart(historyList, statuses) {
      const container = document.getElementById('scrapeSuccessChartContainer');
      const tooltipBar = document.getElementById('chartTooltipBar');
      const avgLabel = document.getElementById('chartAvgSuccessRate');
      const totalRunsLabel = document.getElementById('chartTotalRuns');
      if (!container) return;

      let items = historyList || [];
      if (items.length === 0 && statuses && statuses.length > 0) {
        const successful = statuses.filter((s) => s.totalListings > 0).length;
        items = [{
          timestamp: statuses[0].scrapedAt,
          totalPages: statuses.length,
          successfulPages: successful,
          successRate: Number(((successful / statuses.length) * 100).toFixed(1)),
          totalListings: statuses.reduce((acc, s) => acc + (s.totalListings || 0), 0),
        }];
      }

      if (totalRunsLabel) totalRunsLabel.textContent = String(items.length);
      if (items.length === 0) {
        if (avgLabel) avgLabel.textContent = '—';
        container.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--text-muted);gap:0.5rem;">' +
          '<div style="font-size:2rem;">📉</div>' +
          '<div>No scraping history recorded yet. Run a scrape to populate success rate metrics.</div>' +
        '</div>';
        return;
      }

      const sum = items.reduce((acc, i) => acc + i.successRate, 0);
      const avg = Number((sum / items.length).toFixed(1));
      if (avgLabel) avgLabel.textContent = avg + '%';

      const padLeft = 60;
      const padRight = 30;
      const chartW = 840 - padLeft - padRight;
      const topY = 25;
      const bottomY = 215;
      const chartH = bottomY - topY;

      const pts = items.map((item, idx) => {
        const x = items.length === 1
          ? padLeft + chartW / 2
          : padLeft + (idx / (items.length - 1)) * chartW;
        const rate = Math.max(0, Math.min(100, item.successRate));
        const y = bottomY - (rate / 100) * chartH;
        const d = new Date(item.timestamp);
        const timeLabel = isNaN(d.getTime()) ? 'Recent' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const fullTime = isNaN(d.getTime()) ? 'Recent' : d.toLocaleString();
        return {
          x,
          y,
          rate,
          timeLabel,
          fullTime,
          totalPages: item.totalPages,
          successfulPages: item.successfulPages,
        };
      });

      const lineD = pts.length === 1
        ? 'M ' + (pts[0].x - 50) + ' ' + pts[0].y + ' L ' + (pts[0].x + 50) + ' ' + pts[0].y
        : pts.map((p, i) => (i === 0 ? 'M' : 'L') + ' ' + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' ');

      const areaD = pts.length === 1
        ? 'M ' + (pts[0].x - 50) + ' ' + bottomY + ' L ' + (pts[0].x - 50) + ' ' + pts[0].y + ' L ' + (pts[0].x + 50) + ' ' + pts[0].y + ' L ' + (pts[0].x + 50) + ' ' + bottomY + ' Z'
        : lineD + ' L ' + pts[pts.length - 1].x.toFixed(1) + ' ' + bottomY + ' L ' + pts[0].x.toFixed(1) + ' ' + bottomY + ' Z';

      const circlesHtml = pts.map((pt, i) => {
        return '<g>' +
          '<circle cx="' + pt.x.toFixed(1) + '" cy="' + pt.y.toFixed(1) + '" r="6" fill="#10b981" stroke="var(--bg-panel)" stroke-width="2.5" style="cursor:pointer;" onmouseenter="showChartTooltip(' + i + ')" onmouseleave="hideChartTooltip()">' +
            '<title>' + escapeHtml(pt.fullTime) + ': ' + pt.rate + '% (' + pt.successfulPages + '/' + pt.totalPages + ' pages)</title>' +
          '</circle>' +
          '<text x="' + pt.x.toFixed(1) + '" y="245" font-size="11" fill="var(--text-muted)" text-anchor="middle" font-family="inherit">' + escapeHtml(pt.timeLabel) + '</text>' +
        '</g>';
      }).join('');

      container.innerHTML = '<svg viewBox="0 0 840 260" preserveAspectRatio="none" style="width:100%;height:100%;overflow:visible;">' +
        '<defs>' +
          '<linearGradient id="chartGradientFallback" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0%" stop-color="#10b981" stop-opacity="0.32" />' +
            '<stop offset="100%" stop-color="#10b981" stop-opacity="0.0" />' +
          '</linearGradient>' +
        '</defs>' +
        '<line x1="60" y1="25" x2="810" y2="25" stroke="var(--border)" stroke-dasharray="4 4" stroke-width="1" opacity="0.6" />' +
        '<text x="50" y="29" font-size="11" fill="var(--text-muted)" text-anchor="end">100%</text>' +
        '<line x1="60" y1="72.5" x2="810" y2="72.5" stroke="var(--border)" stroke-dasharray="4 4" stroke-width="1" opacity="0.6" />' +
        '<text x="50" y="76.5" font-size="11" fill="var(--text-muted)" text-anchor="end">75%</text>' +
        '<line x1="60" y1="120" x2="810" y2="120" stroke="var(--border)" stroke-dasharray="4 4" stroke-width="1" opacity="0.6" />' +
        '<text x="50" y="124" font-size="11" fill="var(--text-muted)" text-anchor="end">50%</text>' +
        '<line x1="60" y1="167.5" x2="810" y2="167.5" stroke="var(--border)" stroke-dasharray="4 4" stroke-width="1" opacity="0.6" />' +
        '<text x="50" y="171.5" font-size="11" fill="var(--text-muted)" text-anchor="end">25%</text>' +
        '<line x1="60" y1="215" x2="810" y2="215" stroke="var(--border)" stroke-width="1" opacity="0.8" />' +
        '<text x="50" y="219" font-size="11" fill="var(--text-muted)" text-anchor="end">0%</text>' +
        '<path d="' + areaD + '" fill="url(#chartGradientFallback)" />' +
        '<path d="' + lineD + '" fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />' +
        circlesHtml +
      '</svg>';

      window._chartPts = pts;
    }

    window.showChartTooltip = (idx) => {
      const bar = document.getElementById('chartTooltipBar');
      const pt = window._chartPts?.[idx];
      if (!bar || !pt) return;
      bar.style.display = 'flex';
      bar.innerHTML = '<span>🕒 <strong>' + escapeHtml(pt.fullTime) + '</strong></span>' +
        '<span style="margin-inline-start:1rem;color:#10b981;font-weight:700;">● ' + pt.rate + '% Success Rate</span>' +
        '<span style="margin-inline-start:0.5rem;color:var(--text-muted);">(' + pt.successfulPages + '/' + pt.totalPages + ' pages extracted)</span>';
    };

    window.hideChartTooltip = () => {
      const bar = document.getElementById('chartTooltipBar');
      if (bar) bar.style.display = 'none';
    };

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
        const b = st.bestDeal || st.bestEffectiveDeal;
        if (b && (!bestEneba || b.discountPct > bestEneba.discountPct)) {
          bestEneba = b;
        }
      });

      document.getElementById('enebaKpiBestPct').textContent = bestEneba ? '-' + bestEneba.discountPct.toFixed(2) + '%' : '0.00%';
      document.getElementById('enebaKpiBestTitle').textContent = bestEneba
        ? bestEneba.title + ' ($' + (bestEneba.sellingPrice?.toFixed(2) ?? 'N/A') + ')'
        : 'No Eneba deals scraped yet';
      document.getElementById('enebaKpiOffersCount').textContent = totalOffers + ' Offers';

      // Eneba Summary Table
      const summaryBody = document.getElementById('enebaSummaryBody');
      if (!statuses || statuses.length === 0) {
        summaryBody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);">No Eneba scrape results yet. Click "Scrape Eneba Pages" above.</td></tr>';
      } else {
        const sort = tableSortState.enebaSummary;
        const indexed = statuses.map((st, originalIdx) => {
          const best = st.bestDeal || st.bestEffectiveDeal;
          return {
            st,
            originalIdx,
            category: st.category,
            inStockCount: st.inStockCount,
            avgDirect: st.averageDiscountPctAllInStock,
            bestDiscount: best ? best.discountPct : -1,
            offersCount: st.bestDealOffers ? st.bestDealOffers.length : 0,
            scrapedAt: new Date(st.scrapedAt).getTime(),
          };
        });

        indexed.sort((a, b) => compareValues(a[sort.key], b[sort.key], sort.dir));

        summaryBody.innerHTML = indexed.map((item) => {
          const { st, originalIdx } = item;
          const best = st.bestDeal || st.bestEffectiveDeal;
          const offersCount = st.bestDealOffers ? st.bestDealOffers.length : 0;
          const bestHtml = best
            ? '<a href="' + escapeHtml(best.url) + '" target="_blank" rel="noopener"><strong>-' +
              best.discountPct.toFixed(2) + '% ($' + (best.sellingPrice?.toFixed(2) ?? 'N/A') + ')</strong> — ' +
              escapeHtml(best.title) + '</a>'
            : '<span style="color:var(--text-muted);">None in stock</span>';

          return '<tr>' +
            '<th>' + escapeHtml(st.category) + '</th>' +
            '<td>' + st.inStockCount + ' / ' + st.totalListings + '</td>' +
            '<td><span class="badge badge-discount">-' + st.averageDiscountPctAllInStock.toFixed(2) + '%</span></td>' +
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
      const threshBadge = document.getElementById('enebaAlertThreshBadge');
      if (threshBadge) threshBadge.textContent = enebaAlertThreshold + '%';
      const limitTitle = document.getElementById('enebaTableLimitTitle');
      if (limitTitle) limitTitle.textContent = pullLimit;
      const limitSub = document.getElementById('enebaTableLimitSub');
      if (limitSub) limitSub.textContent = pullLimit;

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
        (st.rankedDeals || []).forEach((deal) => {
          if (searchQ) {
            const hay = (deal.title + ' ' + st.category + ' ' + deal.region).toLowerCase();
            if (!searchQ.split(/\\s+/).every((tok) => hay.includes(tok))) return;
          }
          flatDeals.push({
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

      // Sort by highest discount percentage descending
      flatDeals.sort((a, b) => b.discountPct - a.discountPct);

      // Only show top N (pullLimit) with the highest discount across monitored pages
      const topDeals = flatDeals.slice(0, pullLimit);

      // Re-sort the top deals if a table column sort header was clicked
      const sort = tableSortState.enebaDeals;
      if (sort && (sort.key !== 'discountPct' || sort.dir !== 'desc')) {
        topDeals.sort((a, b) => compareValues(a[sort.key], b[sort.key], sort.dir));
      }

      topDeals.forEach((deal, idx) => {
        deal.rank = idx + 1;
      });

      if (topDeals.length === 0) {
        dealsBody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);">No matching Eneba deals found.</td></tr>';
        return;
      }

      dealsBody.innerHTML = topDeals.map((deal) => {
        const isAlertMatch = deal.discountPct >= enebaAlertThreshold;
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
          '<td><span class="badge badge-discount">-' + deal.discountPct.toFixed(2) + '%</span></td>' +
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
      const allKeys = Array.from(schemaByKey.keys());

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
          group: meta ? meta.group : 'config',
          isEnvOnly,
          value: val,
          displayVal,
          description: meta ? meta.description : '',
        };
      });

      const sort = tableSortState.config;
      rows.sort((a, b) => compareValues(a[sort.key], b[sort.key], sort.dir));

      tbody.innerHTML = rows.map((r) => {
        const lockIcon = r.isEnvOnly ? ' <span title="Change in .env (Restart Required)">🔒</span>' : '';

        return '<tr>' +
          '<th><code>' + escapeHtml(r.key) + '</code>' + lockIcon + '</th>' +
          '<td><span class="badge badge-provider">' + escapeHtml(r.group) + '</span></td>' +
          '<td>' + r.displayVal + '</td>' +
          '<td style="color:var(--text-muted);font-size:0.82rem;">' + escapeHtml(r.description) + '</td>' +
        '</tr>';
      }).join('');
    }

    function syncDependentConfigFields() {
      const cronSelect = document.getElementById('env_CRON_ENABLED');
      const isCronDisabled = cronSelect ? cronSelect.value === 'false' : false;
      ['CRON_BASE_TIME', 'CRON_JITTER_MINUTES'].forEach((k) => {
        const el = document.getElementById('env_' + k);
        const container = document.getElementById('field_container_' + k);
        if (el) el.disabled = isCronDisabled;
        if (container) {
          container.style.opacity = isCronDisabled ? '0.45' : '1';
          container.style.pointerEvents = isCronDisabled ? 'none' : 'auto';
        }
      });

      const emailSelect = document.getElementById('env_EMAIL_ENABLED');
      const isEmailDisabled = emailSelect ? emailSelect.value === 'false' : false;
      ['RESEND_API_KEY', 'ALERT_EMAIL_FROM', 'ALERT_EMAIL_TO', 'ALERT_DISCOUNT_THRESHOLD_PCT'].forEach((k) => {
        const el = document.getElementById('env_' + k);
        const container = document.getElementById('field_container_' + k);
        if (el) el.disabled = isEmailDisabled;
        if (container) {
          container.style.opacity = isEmailDisabled ? '0.45' : '1';
          container.style.pointerEvents = isEmailDisabled ? 'none' : 'auto';
        }
      });
    }

    function renderEnvEditorFields(env) {
      const container = document.getElementById('envFieldsContainer');
      const schemaByKey = new Map((env.schema || []).map((f) => [f.key, f]));
      const allKeys = Array.from(schemaByKey.keys());

      const sections = [
        {
          id: 'env',
          title: '🔒 Section 1: Boot & Database Environment (.env — Read-Only)',
          subtitle: 'These settings sit in .env and cannot be changed from the UI. Change in .env and restart the server if modified.',
        },
        {
          id: 'scrapling',
          title: '🕸️ Section 2: Scrapling MCP Engine & Timezone',
          subtitle: 'MCP server port, engine mode, and local timezone settings.',
        },
        {
          id: 'scheduler',
          title: '⏰ Section 3: Daily Randomized Cron Scheduler',
          subtitle: 'Controls the daily scrape window (base start time + random jitter minutes).',
        },
        {
          id: 'email',
          title: '✉️ Section 4: Resend Email Deal Alerts',
          subtitle: 'Controls email notification recipient, sender, API key, and discount % threshold.',
        },
      ];

      const grouped = new Map(sections.map((s) => [s.id, []]));
      allKeys.forEach((key) => {
        const meta = schemaByKey.get(key);
        const groupId = meta?.group && grouped.has(meta.group) ? meta.group : 'scrapling';
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
          const isBoolean = meta?.inputType === 'boolean' || key === 'CRON_ENABLED' || key === 'EMAIL_ENABLED';
          const desc = meta ? meta.description : '';
          const tooltipAttr = isEnvOnly
            ? ' disabled title="Change in .env and require restart if changed" style="opacity:0.65;cursor:not-allowed;"'
            : '';

          let inputHtml = '';
          if (isBoolean) {
            const normVal = String(val).toLowerCase() === 'false' ? 'false' : 'true';
            inputHtml = '<select class="form-select" id="env_' + escapeHtml(key) + '"' +
              (isEnvOnly ? ' disabled' : ' data-env-key="' + escapeHtml(key) + '"') +
              ' aria-describedby="hint_' + escapeHtml(key) + '"' + tooltipAttr + '>' +
              '<option value="true"' + (normVal === 'true' ? ' selected' : '') + '>true (Enabled)</option>' +
              '<option value="false"' + (normVal === 'false' ? ' selected' : '') + '>false (Disabled)</option>' +
            '</select>';
          } else {
            inputHtml = '<input type="' + inputType + '" id="env_' + escapeHtml(key) + '"' +
              (isEnvOnly ? '' : ' data-env-key="' + escapeHtml(key) + '"') +
              ' value="' + escapeHtml(val) + '" aria-describedby="hint_' + escapeHtml(key) + '"' + tooltipAttr + ' />';
          }

          return '<div class="field" id="field_container_' + escapeHtml(key) + '" style="background:var(--bg-panel-alt);padding:0.85rem;border:1px solid var(--border);border-radius:10px;transition:opacity 0.2s ease;"' +
            (isEnvOnly ? ' title="Change in .env and require restart if changed"' : '') + '>' +
            '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.4rem;">' +
              '<label for="env_' + escapeHtml(key) + '"><code>' + escapeHtml(key) + '</code></label>' +
              (isEnvOnly
                ? '<span class="badge badge-alert" title="Change in .env and require restart if changed">🔒 Change in .env (Restart Required)</span>'
                : '') +
            '</div>' +
            '<span id="hint_' + escapeHtml(key) + '" class="hint">' + escapeHtml(desc) + '</span>' +
            inputHtml +
          '</div>';
        }).join('');

        return '<div style="margin-block-end:1.4rem;padding-block-end:1rem;border-block-end:1px solid var(--border);">' +
          '<h3 style="margin:0 0 0.2rem;font-size:0.95rem;color:#e2e8f0;">' + escapeHtml(sec.title) + '</h3>' +
          '<div style="font-size:0.78rem;color:var(--text-muted);margin-block-end:0.85rem;">' + escapeHtml(sec.subtitle) + '</div>' +
          '<div class="form-grid">' + fieldsHtml + '</div>' +
        '</div>';
      }).join('');

      const cronSelect = document.getElementById('env_CRON_ENABLED');
      if (cronSelect) cronSelect.addEventListener('change', syncDependentConfigFields);
      const emailSelect = document.getElementById('env_EMAIL_ENABLED');
      if (emailSelect) emailSelect.addEventListener('change', syncDependentConfigFields);
      syncDependentConfigFields();
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
        const modal = document.getElementById('enebaConfigModal');
        if (modal && typeof modal.close === 'function') modal.close();
        renderAll();
      } catch (err) {
        showToast('Failed to update Eneba config: ' + (err.message || err));
      }
    });

    const btnOpenEnebaConfigModal = document.getElementById('btnOpenEnebaConfigModal');
    if (btnOpenEnebaConfigModal) {
      btnOpenEnebaConfigModal.addEventListener('click', () => {
        const modal = document.getElementById('enebaConfigModal');
        if (modal && typeof modal.showModal === 'function') modal.showModal();
      });
    }

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

    // Theme toggle (Light / Dark / System)
    const THEME_MODES = ['system', 'light', 'dark'];
    let currentThemeMode = localStorage.getItem('theme') || 'system';

    function applyTheme(mode) {
      currentThemeMode = mode;
      const root = document.documentElement;
      const btnIcon = document.getElementById('themeBtnIcon');
      const btnLabel = document.getElementById('themeBtnLabel');

      if (mode === 'dark') {
        root.setAttribute('data-theme', 'dark');
        document.body.classList.remove('light-theme');
        localStorage.setItem('theme', 'dark');
        if (btnIcon) btnIcon.textContent = '🌙';
        if (btnLabel) btnLabel.textContent = 'Theme: Dark';
      } else if (mode === 'light') {
        root.setAttribute('data-theme', 'light');
        document.body.classList.add('light-theme');
        localStorage.setItem('theme', 'light');
        if (btnIcon) btnIcon.textContent = '☀️';
        if (btnLabel) btnLabel.textContent = 'Theme: Light';
      } else {
        root.removeAttribute('data-theme');
        document.body.classList.remove('light-theme');
        localStorage.removeItem('theme');
        if (btnIcon) btnIcon.textContent = '🖥️';
        if (btnLabel) btnLabel.textContent = 'Theme: System';
      }
    }

    applyTheme(currentThemeMode);

    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', () => {
        const nextIdx = (THEME_MODES.indexOf(currentThemeMode) + 1) % THEME_MODES.length;
        applyTheme(THEME_MODES[nextIdx]);
      });
    }

    fetchDashboard();
    setInterval(fetchDashboard, 2500);
  </script>`;
}
