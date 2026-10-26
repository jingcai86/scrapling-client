import { renderStyles } from "./styles.js";
import { renderHeader, renderScrapeBanner, renderToast } from "./layout.js";
import { renderHomeTab } from "./components/homeTab.js";
import { renderEnebaTab } from "./components/enebaTab.js";
import { renderScrapingTab } from "./components/scrapingTab.js";
import { renderConfigTab } from "./components/configTab.js";
import { renderModals } from "./components/modals.js";
import { renderClientScripts } from "./scripts.js";

export function renderDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Scrapling Monitor — Home, Eneba, Scraping & Configuration</title>
  ${renderStyles()}
  <script src="https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js"></script>
</head>
<body>
  ${renderHeader()}

  <main class="container">
    <!-- Global Live Scrape Progress Banner -->
    ${renderScrapeBanner()}

    <!-- =================================================================== -->
    <!-- PAGE 1: HOME (MONITORED PROVIDERS & SYSTEM STATUS)                  -->
    <!-- =================================================================== -->
    ${renderHomeTab()}

    <!-- =================================================================== -->
    <!-- PAGE 2: DEDICATED ENEBA PAGE (/eneba)                               -->
    <!-- =================================================================== -->
    ${renderEnebaTab()}

    <!-- =================================================================== -->
    <!-- PAGE 3: CRON SCHEDULER & TARGETS (ACTIONS, SCHEDULE & PAGES)       -->
    <!-- =================================================================== -->
    ${renderScrapingTab()}
  </main>

  ${renderConfigTab()}

  ${renderModals()}

  ${renderToast()}

  ${renderClientScripts()}
</body>
</html>`;
}
