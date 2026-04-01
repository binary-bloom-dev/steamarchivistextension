import { API_BASE, PARSER_VERSION, STORAGE_KEYS } from '@/lib/constants';

/** Return true if the response advertises a JSON content type. */
function isJsonResponse(resp: Response): boolean {
  return (resp.headers.get('content-type') ?? '').includes('application/json');
}
import type { SubmitHistoryMessage, SubmitHistoryResponse, SelfUninstallResponse } from '@/lib/messages';
import type { SubmissionPayload } from '@/lib/types';

function isSubmitHistoryMessage(m: unknown): m is SubmitHistoryMessage {
  if (typeof m !== 'object' || m === null) return false;
  const msg = m as Record<string, unknown>;
  return (
    msg['type'] === 'SUBMIT_HISTORY' &&
    typeof msg['steamId'] === 'string' &&
    /^\d{17}$/.test(msg['steamId'] as string) &&
    Array.isArray(msg['transactions'])
  );
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, sender) => {
    // Only accept messages from this extension's own scripts
    if (sender.id !== browser.runtime.id) return false;

    if (isSubmitHistoryMessage(message)) {
      return handleSubmission(message);
    }
    if (message.type === 'SELF_UNINSTALL') {
      return handleUninstall();
    }
    return false;
  });
});

async function handleSubmission(message: SubmitHistoryMessage): Promise<SubmitHistoryResponse> {
  const stored = await browser.storage.session.get([STORAGE_KEYS.token]);
  const token = typeof stored[STORAGE_KEYS.token] === 'string'
    ? (stored[STORAGE_KEYS.token] as string)
    : undefined;

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
      signal: AbortSignal.timeout(60_000),
    });

    // Token is single-use — clear it regardless of outcome
    await browser.storage.session.remove(STORAGE_KEYS.token);

    if (!resp.ok) {
      // Only attempt JSON parse if the server says it's JSON (INPUT-1)
      const body = isJsonResponse(resp) ? await resp.json().catch(() => null) : null;
      const raw = body?.detail?.message ?? body?.detail;
      const detail = typeof raw === 'string' ? raw : `HTTP ${resp.status}`;
      return { success: false, error: detail };
    }

    if (!isJsonResponse(resp)) {
      return { success: false, error: 'Unexpected response type from server' };
    }

    const data = await resp.json();
    return { success: true, data: data.data };
  } catch (err) {
    await browser.storage.session.remove(STORAGE_KEYS.token);
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
