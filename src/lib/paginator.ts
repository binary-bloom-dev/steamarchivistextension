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
 *
 * Uses a terminator-anchored pattern (`};`) so nested objects don't trip up
 * the match, and falls back gracefully if JSON.parse rejects the result.
 */
export function extractInitialCursor(): string | null {
  const scripts = document.querySelectorAll('script:not([src])');
  for (const script of scripts) {
    const text = script.textContent ?? '';
    const match = text.match(/g_historyCursor\s*=\s*(\{[\s\S]*?\});/);
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

  // Params are fixed for the duration of this call — construct once outside the retry loop.
  const params = new URLSearchParams({ cursor, sessionid: sessionId });

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1));
    }

    const resp = await fetch(STEAM_AJAX_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      credentials: 'include',
      signal: AbortSignal.timeout(30_000),
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

    if (response.success !== 1 || !response.html) break;

    // Strip tags that cause network activity (img, link, script, etc.) before
    // parsing, so DOMParser cannot trigger resource fetches for embedded URLs
    // in Steam's response HTML.
    const sanitized = response.html.replace(
      /<(img|link|script|iframe|object|embed|audio|video|source|track|input)[^>]*\/?>/gi,
      '',
    );
    const doc = new DOMParser().parseFromString(sanitized, 'text/html');
    const pageTransactions = parseTransactionRows(doc.body);

    if (pageTransactions.length === 0) break;

    // push instead of concat to avoid O(n²) allocations across many pages
    allTransactions.push(...pageTransactions);

    // Yield the live array directly — callers must not mutate it (PERF-TC-1).
    yield {
      transactions: allTransactions,
      currentPage: page,
      totalTransactions: allTransactions.length,
    };

    // Advance cursor — stop if Steam doesn't provide a next one
    cursorJson = response.cursor ? JSON.stringify(response.cursor) : null;
  }
}
