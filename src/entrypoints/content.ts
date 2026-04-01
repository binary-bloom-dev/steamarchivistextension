import { extractSteamId } from '@/lib/steam-id';
import { paginateHistory } from '@/lib/paginator';
import { buildCsv, downloadCsv } from '@/lib/csv';
import { injectExportUI } from '@/components/ui';
import { STORAGE_KEYS } from '@/lib/constants';
import type { SubmitHistoryMessage, SubmitHistoryResponse } from '@/lib/messages';
import type { ParsedTransaction } from '@/lib/types';

export default defineContentScript({
  matches: ['https://store.steampowered.com/account/history*'],
  runAt: 'document_idle',

  main() {
    const steamId = extractSteamId();
    if (!steamId) return; // Not logged in or page structure changed

    let exporting = false;
    // Held per-click so that cancelling and re-exporting creates a fresh signal
    // rather than leaving the AbortController permanently aborted (AUTH-3).
    let currentAbort: AbortController | null = null;

    const ui = injectExportUI(
      // onClick
      async () => {
        if (exporting) return;
        exporting = true;
        currentAbort = new AbortController();

        ui.setButtonEnabled(false);
        ui.setCancelVisible(true);
        ui.setButtonText('Exporting...');

      try {
        // Check token exists AND has not expired before starting the long
        // pagination process (AUTH-2) — avoids wasting minutes on a stale token.
        const stored = await browser.storage.session.get([
          STORAGE_KEYS.token,
          STORAGE_KEYS.acquiredAt,
          STORAGE_KEYS.expiresIn,
        ]);
        const token = stored[STORAGE_KEYS.token];
        const acquiredAt = stored[STORAGE_KEYS.acquiredAt] as number | undefined;
        const expiresIn = (stored[STORAGE_KEYS.expiresIn] as number | undefined) ?? 600;
        const isExpired = acquiredAt != null && Date.now() - acquiredAt > expiresIn * 1000;

        if (!token || isExpired) {
          const reason = isExpired
            ? 'Token expired. Visit steamarchivist.com while logged in to refresh.'
            : 'Not linked to SteamArchivist. Visit steamarchivist.com while logged in, then try again.';
          ui.setStatus('warning', reason);
          ui.setButtonEnabled(true);
          ui.setCancelVisible(false);
          ui.setButtonText('Export Full History to SteamArchivist');
          exporting = false;
          return;
        }

        let allTransactions: ParsedTransaction[] = [];

        for await (const progress of paginateHistory(currentAbort.signal)) {
          allTransactions = progress.transactions;
          ui.setProgress(progress.currentPage, progress.totalTransactions);
        }

        if (allTransactions.length === 0) {
          ui.setStatus('warning', 'No purchase history found.');
          ui.setButtonEnabled(true);
          ui.setCancelVisible(false);
          ui.setButtonText('Export Full History to SteamArchivist');
          exporting = false;
          return;
        }

        // Download CSV locally first — the user always gets a copy regardless of API success
        const csv = buildCsv(allTransactions);
        const timestamp = new Date().toISOString().slice(0, 10);
        downloadCsv(csv, `steam-purchase-history-${timestamp}.csv`);

        // Send structured data to the API via background script
        ui.setButtonText('Sending to SteamArchivist...');

        const message: SubmitHistoryMessage = {
          type: 'SUBMIT_HISTORY',
          steamId,
          transactions: allTransactions,
        };

        const response = await browser.runtime.sendMessage(message) as SubmitHistoryResponse;

        if (response.success && response.data) {
          const d = response.data;
          ui.setStatus('success',
            `Done! ${d.records_saved} records saved to SteamArchivist. ` +
            `CSV also downloaded locally. You can now remove this extension.`
          );

          // Offer self-uninstall after a brief pause
          setTimeout(async () => {
            try {
              await browser.runtime.sendMessage({ type: 'SELF_UNINSTALL' });
            } catch {
              // Firefox doesn't support uninstallSelf — user removes manually
            }
          }, 3000);
        } else {
          ui.setStatus('error',
            `API error: ${response.error ?? 'Unknown error'}. ` +
            `Your CSV has been downloaded locally as a backup.`
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        ui.setStatus('error', `Export failed: ${msg}. Check your CSV download for a local backup.`);
      } finally {
        ui.setButtonEnabled(true);
        ui.setCancelVisible(false);
        ui.setButtonText('Export Full History to SteamArchivist');
        exporting = false;
      }
    },
    // onCancel
    () => {
      currentAbort?.abort();
    },
    );

    // Warn if navigating away during export
    window.addEventListener('beforeunload', (e) => {
      if (exporting) {
        e.preventDefault();
        e.returnValue = ''; // required by some older Chromium builds
      }
    });
  },
});
