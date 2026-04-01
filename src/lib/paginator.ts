import type { ParsedTransaction } from './types';
import { parseTransactionRows } from './parser';
import { STEAM_AJAX_URL, PAGINATION_DELAY_MS, MAX_RETRIES, RETRY_BASE_DELAY_MS } from './constants';

interface AjaxHistoryResponse {
  success: number;
  html: string;
  cursor?: {
    wallet_txnid: string;
    timestamp_newest: number;
    balance: string;
    currency: number;
  };
}

/**
 * Extract the initial cursor from inline script on the history page.
 * Steam sets `g_historyCursor` as a JSON object in a script tag.
 */
export function extractInitialCursor(): string | null {
  const scripts = document.querySelectorAll('script:not([src])');
  for (const script of scripts) {
    const text = script.textContent ?? '';
    const match = text.match(/g_historyCursor\s*=\s*({[^}]+})/);
    if (match) {
      try {
        const cursor = JSON.parse(match[1]);
        return JSON.stringify(cursor);
      } catch {
        continue;
      }
    }
  }
  return null;
}

/**
 * Get the session ID cookie needed for Steam AJAX requests.
 */
function getSessionId(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)sessionid=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch a single page of transaction history via Steam's AJAX endpoint.
 * Retries with exponential backoff on transient failures.
 */
async function fetchPage(cursor: string, sessionId: string): Promise<AjaxHistoryResponse> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1));
    }

    const params = new URLSearchParams({
      cursor,
      sessionid: sessionId,
    });

    const resp = await fetch(STEAM_AJAX_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      credentials: 'include',
    });

    if (resp.status === 401 || resp.status === 403) {
      throw new Error('Steam session expired. Please log in to Steam and try again.');
    }

    if (resp.status === 429) {
      // Rate limited — wait longer and retry
      await sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempt + 1));
      lastError = new Error('Rate limited by Steam');
      continue;
    }

    if (!resp.ok) {
      lastError = new Error(`Steam returned ${resp.status}`);
      continue;
    }

    return await resp.json() as AjaxHistoryResponse;
  }

  throw lastError ?? new Error('Failed to fetch history page');
}

export interface PaginationProgress {
  transactions: ParsedTransaction[];
  currentPage: number;
  totalTransactions: number;
}

/**
 * Paginate through the full purchase history, yielding batches as they load.
 *
 * This is an async generator so the UI can show real-time progress.
 * The first batch comes from the DOM (already loaded), subsequent
 * batches come from Steam's AJAX pagination endpoint.
 */
export async function* paginateHistory(
  signal?: AbortSignal,
): AsyncGenerator<PaginationProgress> {
  // First batch: parse what's already on the page
  const initialRows = parseTransactionRows(document);
  let allTransactions = [...initialRows];
  let page = 1;

  yield { transactions: allTransactions, currentPage: page, totalTransactions: allTransactions.length };

  // Get cursor and session ID for subsequent pages
  let cursorJson = extractInitialCursor();
  const sessionId = getSessionId();

  if (!cursorJson || !sessionId) {
    // No pagination available — single page of results
    return;
  }

  while (cursorJson) {
    if (signal?.aborted) {
      throw new Error('Export cancelled');
    }

    await sleep(PAGINATION_DELAY_MS);
    page++;

    const response = await fetchPage(cursorJson, sessionId);

    if (!response.success || !response.html) break;

    // Parse the HTML fragment returned by the AJAX call
    const fragment = document.createElement('div');
    fragment.innerHTML = response.html;
    const pageTransactions = parseTransactionRows(fragment);

    if (pageTransactions.length === 0) break;

    allTransactions = allTransactions.concat(pageTransactions);

    yield {
      transactions: allTransactions,
      currentPage: page,
      totalTransactions: allTransactions.length,
    };

    // Advance cursor — stop if Steam doesn't provide a next one
    cursorJson = response.cursor ? JSON.stringify(response.cursor) : null;
  }
}
