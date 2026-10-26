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
          <div class="card-header" style="flex-wrap:wrap;gap:0.75rem;">
            <div>
              <h4 style="margin:0;font-size:0.95rem;">Configuration Variables</h4>
            </div>
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;">
              <button type="button" class="btn btn-sm" id="btnToggleSecrets">👁 Show Secrets</button>
              <button type="button" class="btn btn-sm" id="btnPreviewEmailConfig">✉ Preview Alert Email</button>
              <div style="display:inline-flex;align-items:center;gap:0.35rem;">
                <button type="button" class="btn btn-sm btn-success" id="btnSendTestEmail">🚀 Send Test Email to</button>
                <input type="email" id="testEmailRecipientInput" class="form-control" style="font-size:0.8rem;padding:0.25rem 0.55rem;width:210px;height:31px;border-radius:6px;border:1px solid var(--border);background:var(--bg-panel);color:var(--text);" placeholder="Recipient email" title="Test email recipient (defaults to ALERT_EMAIL_TO)">
              </div>
              <button type="button" class="btn btn-sm btn-primary" id="btnSaveAllEnv">💾 Save Changes</button>
            </div>
          </div>

          <!-- Sectioned Form Editor (Edit mode is the only mode) -->
          <div id="configEditMode" style="display:block;">
            <form id="envEditorForm">
              <div id="envFieldsContainer"></div>
            </form>
          </div>
        </div>
      </div>

      <div class="dialog-footer" style="display:flex;justify-content:flex-end;gap:0.5rem;margin-top:1rem;border-top:1px solid var(--border);padding-top:0.75rem;">
        <button type="button" class="btn btn-primary" onclick="document.getElementById('btnSaveAllEnv')?.click()">💾 Save Changes</button>
        <form method="dialog">
          <button type="submit" class="btn">Close</button>
        </form>
      </div>
    </div>
  </dialog>
  </section>`;
}
