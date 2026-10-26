export function renderModals(): string {
  return `  <!-- ===================================================================== -->
  <!-- LIGHT-DISMISS DIALOGS (modern-web-guidance: light-dismiss-a-dialog)   -->
  <!-- ===================================================================== -->

  <!-- Dialog 1: Add / Edit Scraping Page -->
  <dialog id="pageFormDialog" closedby="any" aria-labelledby="pageFormDialogTitle">
    <div class="dialog-inner">
      <div class="dialog-header">
        <h3 id="pageFormDialogTitle" style="margin:0;font-size:1.05rem;">Add Scraping Page</h3>
        <form method="dialog">
          <button type="submit" class="btn btn-sm">✕ Close</button>
        </form>
      </div>
      <form id="pageModalForm">
        <input type="hidden" id="editPageId" value="" />
        <div class="field">
          <label for="newPageProvider">Provider</label>
          <span id="provider-hint" class="hint">Store provider identifier (e.g., eneba)</span>
          <input
            type="text"
            id="newPageProvider"
            name="provider"
            value="eneba"
            required
            aria-describedby="provider-hint"
            aria-errormessage="provider-err"
          />
          <div id="provider-err" class="error-msg">
            <span aria-hidden="true">❌</span> Provider is required.
          </div>
        </div>

        <div class="field">
          <label for="newPageCategory">Category Name</label>
          <span id="cat-hint" class="hint">Example: Xbox Gift Cards or Steam Gift Cards</span>
          <input
            type="text"
            id="newPageCategory"
            name="categoryName"
            placeholder="Xbox Gift Cards"
            required
            aria-describedby="cat-hint"
            aria-errormessage="cat-err"
          />
          <div id="cat-err" class="error-msg">
            <span aria-hidden="true">❌</span> Please enter a category title.
          </div>
        </div>

        <div class="field">
          <label for="newPageUrl">Category Store URL</label>
          <span id="url-hint" class="hint">Format: https://www.eneba.com/us/store/xbox-gift-cards</span>
          <input
            type="url"
            id="newPageUrl"
            name="url"
            placeholder="https://www.eneba.com/us/store/xbox-gift-cards"
            required
            aria-describedby="url-hint"
            aria-errormessage="url-err"
          />
          <div id="url-err" class="error-msg">
            <span aria-hidden="true">❌</span> Please enter a valid https:// URL.
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:0.6rem;margin:0.75rem 0 1.25rem;">
          <label style="display:inline-flex;align-items:center;gap:0.5rem;font-size:0.875rem;cursor:pointer;">
            <input type="checkbox" id="newPageWithOffers" checked />
            Scrape competing third-party seller offers (headless browser)
          </label>
          <label style="display:inline-flex;align-items:center;gap:0.5rem;font-size:0.875rem;cursor:pointer;">
            <input type="checkbox" id="newPageEnabled" checked />
            Page Enabled for Scheduled &amp; Batch Scrapes
          </label>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:0.5rem;">
          <button type="button" class="btn" onclick="document.getElementById('pageFormDialog').close()">Cancel</button>
          <button type="submit" class="btn btn-primary" id="btnSubmitPageModal">💾 Save Page</button>
        </div>
      </form>
    </div>
  </dialog>

  <!-- Dialog 2: Edit Randomized Daily Cron Schedule -->
  <dialog id="cronFormDialog" closedby="any" aria-labelledby="cronDialogTitle">
    <div class="dialog-inner">
      <div class="dialog-header">
        <h3 id="cronDialogTitle" style="margin:0;font-size:1.05rem;">Edit Randomized Daily Cron Schedule</h3>
        <form method="dialog">
          <button type="submit" class="btn btn-sm">✕ Close</button>
        </form>
      </div>
      <form id="schedulerForm">
        <div class="field">
          <label style="display:inline-flex;align-items:center;gap:0.5rem;cursor:pointer;">
            <input type="checkbox" id="cronEnabledInput" checked />
            Enable Daily Randomized Cron Job (<code>CRON_ENABLED</code>)
          </label>
        </div>

        <div class="field">
          <label for="cronBaseTimeInput">Daily Window Start Time (<code>CRON_BASE_TIME</code>)</label>
          <span id="basetime-hint" class="hint">24-hour time when the random window opens (19:00 = 7:00 PM)</span>
          <input
            type="time"
            id="cronBaseTimeInput"
            required
            value="19:00"
            aria-describedby="basetime-hint"
            aria-errormessage="basetime-err"
          />
          <div id="basetime-err" class="error-msg">
            <span aria-hidden="true">❌</span> Please pick a valid start time.
          </div>
        </div>

        <div class="field">
          <label for="cronJitterInput">Random Jitter Window in Minutes (<code>CRON_JITTER_MINUTES</code>)</label>
          <span id="jitter-hint" class="hint">Random delay (0–720 mins) added to start time each day (default: 60 mins)</span>
          <input
            type="number"
            id="cronJitterInput"
            min="0"
            max="720"
            required
            value="60"
            aria-describedby="jitter-hint"
            aria-errormessage="jitter-err"
          />
          <div id="jitter-err" class="error-msg">
            <span aria-hidden="true">❌</span> Enter a number between 0 and 720 minutes.
          </div>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:0.5rem;margin-top:1rem;">
          <button type="button" class="btn" onclick="document.getElementById('cronFormDialog').close()">Cancel</button>
          <button type="submit" class="btn btn-primary">💾 Save Schedule to .env</button>
        </div>
      </form>
    </div>
  </dialog>

  <!-- Dialog 3: Email Alert Template Preview -->
  <dialog id="emailPreviewDialog" closedby="any" aria-labelledby="emailPreviewTitle">
    <div class="dialog-inner">
      <div class="dialog-header">
        <div>
          <h3 id="emailPreviewTitle" style="margin:0;font-size:1.05rem;">Resend Email Alert Template Preview</h3>
          <div id="emailPreviewSubject" style="font-size:0.82rem;color:var(--text-muted);margin-top:0.2rem;"></div>
        </div>
        <form method="dialog">
          <button type="submit" class="btn btn-sm">✕ Close</button>
        </form>
      </div>
      <iframe
        id="emailPreviewFrame"
        title="Email Alert HTML Preview"
        style="width:100%;height:480px;border:1px solid var(--border);border-radius:8px;background:#fff;"
      ></iframe>
    </div>
  </dialog>

  <!-- Dialog 4: Competing Seller Offers (Sortable Table) -->
  <dialog id="sellerOffersDialog" closedby="any" aria-labelledby="sellerOffersTitle">
    <div class="dialog-inner">
      <div class="dialog-header">
        <div>
          <h3 id="sellerOffersTitle" style="margin:0;font-size:1.05rem;">Competing Third-Party Seller Offers</h3>
          <div id="sellerOffersSub" style="font-size:0.82rem;color:var(--text-muted);margin-top:0.2rem;"></div>
        </div>
        <form method="dialog">
          <button type="submit" class="btn btn-sm">✕ Close</button>
        </form>
      </div>
      <div tabindex="0" role="region" aria-labelledby="offers-modal-caption" class="table-wrapper">
        <table id="offersTable" style="--label-2:'Price';--label-3:'Cashback';--label-4:'Rating';--label-5:'Badge';--label-6:'Store Link';">
          <caption id="offers-modal-caption">Competing seller offers for selected product</caption>
          <thead>
            <tr>
              <th class="sortable" data-table="offers" data-sort-key="sellerName" aria-sort="none">Seller / Merchant <span class="sort-icon">↕</span></th>
              <th class="sortable" data-table="offers" data-sort-key="price" aria-sort="ascending">Price <span class="sort-icon">↑</span></th>
              <th class="sortable" data-table="offers" data-sort-key="cashbackPct" aria-sort="none">Cashback <span class="sort-icon">↕</span></th>
              <th class="sortable" data-table="offers" data-sort-key="ratingScore" aria-sort="none">Rating <span class="sort-icon">↕</span></th>
              <th class="sortable" data-table="offers" data-sort-key="placement" aria-sort="none">Placement <span class="sort-icon">↕</span></th>
              <th>Vendor Link</th>
            </tr>
          </thead>
          <tbody id="sellerOffersBody"></tbody>
        </table>
      </div>
    </div>
  </dialog>`;
}
