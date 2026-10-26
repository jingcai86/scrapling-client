export function renderStyles(): string {
  return `  <style>
    :root {
      --bg: #0f172a;
      --bg-panel: #1e293b;
      --bg-panel-alt: #0f172a;
      --bg-hover: #334155;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --border: #334155;
      --primary: #6366f1;
      --primary-hover: #4f46e5;
      --success: #10b981;
      --success-bg: rgba(16, 185, 129, 0.14);
      --warning: #f59e0b;
      --warning-bg: rgba(245, 158, 11, 0.14);
      --danger: #ef4444;
      --danger-bg: rgba(239, 68, 68, 0.15);
      --radius: 12px;
    }

    :root[data-theme='light'],
    body.light-theme {
      --bg: #f8fafc;
      --bg-panel: #ffffff;
      --bg-panel-alt: #f1f5f9;
      --bg-hover: #e2e8f0;
      --text: #0f172a;
      --text-muted: #64748b;
      --border: #cbd5e1;
      --primary: #4f46e5;
      --primary-hover: #4338ca;
    }

    @media (prefers-color-scheme: light) {
      :root:not([data-theme='dark']) {
        --bg: #f8fafc;
        --bg-panel: #ffffff;
        --bg-panel-alt: #f1f5f9;
        --bg-hover: #e2e8f0;
        --text: #0f172a;
        --text-muted: #64748b;
        --border: #cbd5e1;
        --primary: #4f46e5;
        --primary-hover: #4338ca;
      }
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
    }

    a {
      color: #818cf8;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }

    .app-header {
      background: rgba(30, 41, 59, 0.92);
      backdrop-filter: blur(8px);
      border-block-end: 1px solid var(--border);
      position: sticky;
      inset-block-start: 0;
      z-index: 20;
      padding: 0.9rem 1.5rem;
    }

    .header-inner {
      max-width: 1400px;
      margin: 0 auto;
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      align-items: center;
      justify-content: space-between;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .brand-badge {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: linear-gradient(135deg, #6366f1, #10b981);
      display: grid;
      place-items: center;
      font-weight: 800;
      font-size: 1.1rem;
      color: #fff;
    }

    .brand h1 {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 700;
    }

    .brand p {
      margin: 0;
      font-size: 0.78rem;
      color: var(--text-muted);
    }

    .nav-tabs {
      display: flex;
      gap: 0.35rem;
      flex-wrap: wrap;
      background: var(--bg-panel-alt);
      padding: 0.3rem;
      border-radius: 10px;
      border: 1px solid var(--border);
    }

    .tab-btn {
      background: transparent;
      color: var(--text-muted);
      border: none;
      padding: 0.5rem 0.95rem;
      border-radius: 7px;
      font-size: 0.86rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .tab-btn:hover {
      color: var(--text);
      background: rgba(255, 255, 255, 0.05);
    }

    .tab-btn.active {
      color: #fff;
      background: var(--primary);
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .theme-toggle-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      background: var(--bg-panel-alt);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 0.4rem 0.85rem;
      border-radius: 20px;
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .theme-toggle-btn:hover {
      background: var(--bg-hover);
      border-color: var(--primary);
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.5rem 0.95rem;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 600;
      border: 1px solid var(--border);
      background: var(--bg-panel);
      color: var(--text);
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .btn:hover:not(:disabled) {
      background: var(--bg-hover);
    }

    .btn:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .btn-primary {
      background: var(--primary);
      border-color: var(--primary);
      color: #fff;
    }

    .btn-primary:hover:not(:disabled) {
      background: var(--primary-hover);
    }

    .btn-success {
      background: #059669;
      border-color: #059669;
      color: #fff;
    }

    .btn-danger {
      background: var(--danger-bg);
      border-color: rgba(239, 68, 68, 0.4);
      color: #fca5a5;
    }

    .btn-sm {
      padding: 0.3rem 0.65rem;
      font-size: 0.78rem;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 1.5rem;
    }

    /* Live Scrape Progress Banner */
    .scrape-banner {
      background: linear-gradient(90deg, rgba(99, 102, 241, 0.18), rgba(16, 185, 129, 0.15));
      border: 1px solid rgba(99, 102, 241, 0.45);
      border-radius: var(--radius);
      padding: 0.9rem 1.25rem;
      margin-block-end: 1.5rem;
      display: none;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }

    .scrape-banner.active {
      display: flex;
    }

    .spinner {
      width: 18px;
      height: 18px;
      border: 2.5px solid rgba(255, 255, 255, 0.25);
      border-top-color: #818cf8;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      flex-shrink: 0;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* KPI Grid */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1rem;
      margin-block-end: 1.5rem;
    }

    .kpi-card {
      background: var(--bg-panel);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 1.1rem 1.25rem;
    }

    .kpi-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      font-weight: 600;
    }

    .kpi-value {
      font-size: 1.55rem;
      font-weight: 800;
      margin: 0.25rem 0;
    }

    .kpi-sub {
      font-size: 0.8rem;
      color: var(--text-muted);
    }

    .card {
      background: var(--bg-panel);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 1.25rem;
      margin-block-end: 1.5rem;
    }

    .card-header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      margin-block-end: 1rem;
    }

    .card-title {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 700;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      padding: 0.2rem 0.6rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 700;
    }

    .badge-provider {
      background: rgba(99, 102, 241, 0.2);
      color: #a5b4fc;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .badge-discount {
      background: var(--success-bg);
      color: #34d399;
    }

    .badge-alert {
      background: var(--warning-bg);
      color: #fbbf24;
    }

    .badge-muted {
      background: rgba(148, 163, 184, 0.15);
      color: var(--text-muted);
    }

    /* Modern Responsive & Sortable Table (modern-web-guidance: responsive-table) */
    .table-wrapper {
      overflow: auto;
      max-inline-size: 100%;
      max-block-size: min(640px, 80vh);
      container-type: inline-size;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--bg-panel-alt);
    }

    table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      text-align: left;
      font-size: 0.875rem;
    }

    caption {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    thead {
      position: sticky;
      inset-block-start: 0;
      z-index: 1;
      background: #1e293b;
    }

    th, td {
      padding: 0.72rem 0.95rem;
      border-block-end: 1px solid var(--border);
      vertical-align: middle;
    }

    thead th {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      font-weight: 700;
      background: #1e293b;
      user-select: none;
      white-space: nowrap;
    }

    thead th.sortable {
      cursor: pointer;
      transition: color 0.15s ease, background 0.15s ease;
    }

    thead th.sortable:hover {
      color: var(--text);
      background: #273549;
    }

    thead th.sortable[aria-sort="ascending"],
    thead th.sortable[aria-sort="descending"] {
      color: #a5b4fc;
      background: rgba(99, 102, 241, 0.15);
    }

    .sort-icon {
      display: inline-block;
      margin-inline-start: 0.35rem;
      font-size: 0.72rem;
      opacity: 0.75;
    }

    tbody th {
      position: sticky;
      inset-inline-start: 0;
      background: var(--bg-panel-alt);
      font-weight: 600;
      color: var(--text);
    }

    tbody tr:hover td,
    tbody tr:hover th {
      background: rgba(51, 65, 85, 0.45);
    }

    @container (width < 600px) {
      table, thead, tbody, tr, th, td {
        display: block;
      }

      thead {
        display: none;
      }

      tr {
        margin-block-end: 1rem;
        border: 1px solid var(--border);
        border-radius: 8px;
        overflow: hidden;
      }

      tbody th {
        position: sticky;
        inset-block-start: 0;
        z-index: 2;
        background: #1e293b;
      }

      td:nth-child(2)::before {
        content: var(--label-2) ": ";
        font-weight: 600;
        color: var(--text-muted);
      }
      td:nth-child(3)::before {
        content: var(--label-3) ": ";
        font-weight: 600;
        color: var(--text-muted);
      }
      td:nth-child(4)::before {
        content: var(--label-4) ": ";
        font-weight: 600;
        color: var(--text-muted);
      }
      td:nth-child(5)::before {
        content: var(--label-5) ": ";
        font-weight: 600;
        color: var(--text-muted);
      }
      td:nth-child(6)::before {
        content: var(--label-6) ": ";
        font-weight: 600;
        color: var(--text-muted);
      }
      td:nth-child(7)::before {
        content: var(--label-7) ": ";
        font-weight: 600;
        color: var(--text-muted);
      }
      td:nth-child(8)::before {
        content: var(--label-8) ": ";
        font-weight: 600;
        color: var(--text-muted);
      }
    }

    /* Form Controls & Deferred Validation (:user-invalid from modern-web-guidance) */
    .form-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(270px, 1fr));
      gap: 1rem;
    }

    .field {
      display: flex;
      flex-direction: column;
      margin-block-end: 0.75rem;
    }

    .field label {
      font-size: 0.84rem;
      font-weight: 600;
      color: var(--text);
      margin-block-end: 0.15rem;
    }

    .hint {
      display: block;
      color: var(--text-muted);
      font-size: 0.75rem;
      margin-block-end: 0.35rem;
    }

    input[type="text"],
    input[type="url"],
    input[type="email"],
    input[type="number"],
    input[type="time"],
    input[type="password"],
    input[type="search"],
    select {
      padding: 0.52rem 0.75rem;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--bg-panel-alt);
      color: var(--text);
      font-size: 0.875rem;
      outline: none;
    }

    input:focus, select:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.25);
    }

    .error-msg {
      display: none;
      color: #fca5a5;
      font-size: 0.8rem;
      margin-block-start: 0.3rem;
    }

    input:user-invalid,
    input.user-invalid-fallback {
      border-color: #ef4444;
      background-color: rgba(239, 68, 68, 0.12);
    }

    input:user-invalid + .error-msg,
    input.user-invalid-fallback + .error-msg {
      display: block;
    }

    input:user-valid {
      border-color: #10b981;
    }

    .tab-panel {
      display: none;
    }

    .tab-panel.active {
      display: block;
    }

    .kv-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 0.85rem;
    }

    .kv-box {
      background: var(--bg-panel-alt);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 0.85rem 1rem;
    }

    .kv-label {
      font-size: 0.75rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .kv-val {
      font-size: 1rem;
      font-weight: 700;
      margin-top: 0.2rem;
    }

    /* Native Light-Dismiss Dialogs (modern-web-guidance: light-dismiss-a-dialog) */
    dialog {
      background: var(--bg-panel);
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 0;
      max-width: min(860px, 94vw);
      width: 100%;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
    }

    dialog.config-modal-dialog {
      max-width: min(1050px, 96vw);
    }

    dialog::backdrop {
      background-color: rgba(0, 0, 0, 0.65);
      backdrop-filter: blur(3px);
    }

    .dialog-inner {
      padding: 1.25rem 1.5rem;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-block-end: 1px solid var(--border);
      padding-block-end: 0.85rem;
      margin-block-end: 1rem;
    }

    .log-box {
      background: #090d16;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 0.75rem 1rem;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.78rem;
      color: #cbd5e1;
      max-height: 200px;
      overflow-y: auto;
    }

    .toast {
      position: fixed;
      inset-block-end: 1.25rem;
      inset-inline-end: 1.25rem;
      background: #1e293b;
      border: 1px solid var(--primary);
      color: #fff;
      padding: 0.75rem 1.1rem;
      border-radius: 10px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.45);
      z-index: 100;
      display: none;
      font-size: 0.85rem;
      font-weight: 600;
    }

    .toast.show {
      display: block;
    }
  </style>`;
}
