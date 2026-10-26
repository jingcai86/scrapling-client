export function renderConfigTab(): string {
  return `  <!-- ===================================================================== -->
  <!-- CONFIGURATION MODAL (modern-web-guidance: light-dismiss-a-dialog)      -->
  <!-- ===================================================================== -->
  <section id="tab-config" class="tab-panel config-modal-container" style="display:contents;">
  <dialog id="configModal" closedby="any" aria-labelledby="configModalTitle" class="modal-dialog config-modal-dialog">
    <div class="dialog-inner config-dialog-inner">
      <div class="dialog-header">
        <div style="display:flex;align-items:center;gap:0.75rem;">
          <span style="font-size:1.5rem;">⚙️</span>
          <div>
            <h3 id="configModalTitle" style="margin:0;font-size:1.15rem;">System &amp; Application Configuration</h3>
            <div style="font-size:0.78rem;color:var(--text-muted);">
              Boot variables (<code>PORT</code>, <code>DATABASE_URL</code>) live in <code id="envFilePathLabel">.env</code>; runtime settings apply immediately.
            </div>
          </div>
        </div>
        <form method="dialog">
          <button type="submit" class="btn btn-sm">✕ Close</button>
        </form>
      </div>

      <div class="config-modal-scroll" style="max-height:72vh;overflow-y:auto;padding-right:0.25rem;">
        <div class="card">
          <div class="card-header">
            <div>
              <h4 style="margin:0;font-size:0.95rem;">Configuration Variables</h4>
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
              <table id="configTable" style="--label-2:'Section';--label-3:'Current Value';--label-4:'Description';">
                <caption id="config-table-caption">Current system and application configuration variables</caption>
                <thead>
                  <tr>
                    <th class="sortable" data-table="config" data-sort-key="key" aria-sort="none">Variable Key <span class="sort-icon">↕</span></th>
                    <th class="sortable" data-table="config" data-sort-key="group" aria-sort="ascending">Section <span class="sort-icon">↑</span></th>
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
              <span style="font-size:0.85rem;font-weight:600;color:#a5b4fc;">Editing Configuration — Runtime settings apply immediately.</span>
              <div style="display:flex;gap:0.5rem;">
                <button type="button" class="btn btn-sm" id="btnCancelConfigEdit">Cancel</button>
                <button type="button" class="btn btn-sm btn-primary" id="btnSaveAllEnv">💾 Save Changes</button>
              </div>
            </div>

            <form id="envEditorForm">
              <div id="envFieldsContainer"></div>
            </form>
          </div>
        </div>
      </div>

      <div class="dialog-footer" style="display:flex;justify-content:flex-end;margin-top:1rem;border-top:1px solid var(--border);padding-top:0.75rem;">
        <form method="dialog">
          <button type="submit" class="btn">Close</button>
        </form>
      </div>
    </div>
  </dialog>
  </section>`;
}
