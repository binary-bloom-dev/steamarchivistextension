import { API_BASE, PARSER_VERSION } from '@/lib/constants';
import type { SubmitHistoryMessage, SubmitHistoryResponse, SelfUninstallResponse } from '@/lib/messages';
import type { SubmissionPayload } from '@/lib/types';

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, _sender) => {
    if (message.type === 'SUBMIT_HISTORY') {
      return handleSubmission(message as SubmitHistoryMessage);
    }
    if (message.type === 'SELF_UNINSTALL') {
      return handleUninstall();
    }
    return false;
  });
});

async function handleSubmission(message: SubmitHistoryMessage): Promise<SubmitHistoryResponse> {
  const stored = await browser.storage.session.get(['token']);
  const token = stored.token as string | undefined;

  if (!token) {
    return { success: false, error: 'No extension token. Visit steamarchivist.com while logged in.' };
  }

  const payload: SubmissionPayload = {
    steam_id: message.steamId,
    transactions: message.transactions.map(tx => ({
      date: tx.date,
      game_name: tx.gameName,
      app_id: tx.appId,
      type: tx.type,
      currency: tx.currency,
      amount: tx.amount,
    })),
    parser_version: PARSER_VERSION,
  };

  try {
    const resp = await fetch(`${API_BASE}/api/v1/extension/purchase-history`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ext:${token}`,
      },
      body: JSON.stringify(payload),
    });

    // Token is single-use — clear it regardless of outcome
    await browser.storage.session.remove('token');

    if (!resp.ok) {
      const body = await resp.json().catch(() => null);
      const detail = body?.detail?.message ?? body?.detail ?? `HTTP ${resp.status}`;
      return { success: false, error: String(detail) };
    }

    const data = await resp.json();
    return { success: true, data: data.data };
  } catch (err) {
    await browser.storage.session.remove('token');
    return { success: false, error: err instanceof Error ? err.message : 'Network error' };
  }
}

async function handleUninstall(): Promise<SelfUninstallResponse> {
  try {
    await browser.management.uninstallSelf({ showConfirmDialog: true });
    return { success: true };
  } catch {
    // Firefox doesn't support uninstallSelf
    return {
      success: false,
      fallback: 'To remove this extension, go to about:addons and click Remove.',
    };
  }
}
