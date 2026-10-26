export function renderConfigTab(): string {
  return `    <section id="tab-config" class="tab-panel">
      <!-- Appearance & Theme Selector Card -->
      <div class="card" style="margin-block-end: 1.5rem;">
        <div class="card-header">
          <div>
            <h2 class="card-title">🎨 Interface Appearance &amp; Color Theme</h2>
            <div style="font-size:0.8rem;color:var(--text-muted);">
              Choose your preferred UI theme. <strong>System Default</strong> synchronizes with your device's light or dark mode.
            </div>
          </div>
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
            <button type="button" class="btn btn-sm config-theme-choice-btn" data-theme-mode="system">🖥️ System Default</button>
            <button type="button" class="btn btn-sm config-theme-choice-btn" data-theme-mode="light">☀️ Light Theme</button>
            <button type="button" class="btn btn-sm config-theme-choice-btn" data-theme-mode="dark">🌙 Dark Theme</button>
          </div>
        </div>
      </div>

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
    </section>`;
}
