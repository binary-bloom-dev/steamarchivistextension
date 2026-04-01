import { extractSteamId } from '@/lib/steam-id';
import { paginateHistory } from '@/lib/paginator';
import { buildCsv, downloadCsv } from '@/lib/csv';
import { injectExportUI } from '@/components/ui';
import type { SubmitHistoryMessage, SubmitHistoryResponse } from '@/lib/messages';

export default defineContentScript({
  matches: ['https://store.steampowered.com/account/history*'],
  runAt: 'document_idle',

  main() {
    const steamId = extractSteamId();
    if (!steamId) return; // Not logged in or page structure changed

    let exporting = false;
    const abortController = new AbortController();

    const ui = injectExportUI(async () => {
      if (exporting) return;
      exporting = true;

      ui.setButtonEnabled(false);
      ui.setButtonText('Exporting...');

      try {
        // Check that we have a token before starting the long pagination process
        const stored = await browser.storage.session.get('token');
        if (!stored.token) {
          ui.setStatus('warning', 'Not linked to SteamArchivist. Visit steamarchivist.com while logged in, then try again.');
          ui.setButtonEnabled(true);
          ui.setButtonText('Export Full History to SteamArchivist');
          exporting = false;
          return;
        }

        let allTransactions = [];

        for await (const progress of paginateHistory(abortController.signal)) {
          allTransactions = progress.transactions;
          ui.setProgress(progress.currentPage, progress.totalTransactions);
        }

        if (allTransactions.length === 0) {
          ui.setStatus('warning', 'No purchase history found.');
          ui.setButtonEnabled(true);
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
        ui.setButtonText('Export Full History to SteamArchivist');
        exporting = false;
      }
    });

    // Warn if navigating away during export
    window.addEventListener('beforeunload', (e) => {
      if (exporting) {
        e.preventDefault();
      }
    });
  },
});
