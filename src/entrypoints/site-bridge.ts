/**
 * Content script that runs on steamarchivist.com pages.
 *
 * Automatically acquires a single-use extension token when the user is logged in.
 * The token is stored in session storage (cleared on browser close) and used by
 * the Steam content script to authenticate API submissions.
 *
 * This avoids any manual linking step — the extension "just works" once installed.
 */

import { STORAGE_KEYS, MAX_TOKEN_LENGTH } from '@/lib/constants';

/** Return true if the response advertises a JSON content type. */
function isJsonResponse(resp: Response): boolean {
  return (resp.headers.get('content-type') ?? '').includes('application/json');
}

export default defineContentScript({
  matches: ['https://steamarchivist.com/*'],
  runAt: 'document_idle',

  async main() {
    // Check token and acquiring-lock in one read to prevent race conditions
    // when multiple steamarchivist.com tabs open simultaneously (AUTH-1).
    const stored = await browser.storage.session.get([
      STORAGE_KEYS.token,
      STORAGE_KEYS.acquiring,
    ]);
    if (stored[STORAGE_KEYS.token] || stored[STORAGE_KEYS.acquiring]) return;

    // Claim the acquisition slot before any async work
    await browser.storage.session.set({ [STORAGE_KEYS.acquiring]: true });

    try {
      // Fetch CSRF token first — needed for the POST request.
      // Cookies are included automatically since this script runs in the page's origin.
      const csrfResp = await fetch('/auth/csrf', {
        credentials: 'include',
        signal: AbortSignal.timeout(10_000),
      });
      if (!csrfResp.ok || !isJsonResponse(csrfResp)) return;

      const csrfData = await csrfResp.json();
      const csrfToken = csrfData?.data?.csrf_token;
      if (typeof csrfToken !== 'string' || csrfToken.length === 0) return;

      const tokenResp = await fetch('/api/v1/extension/token', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        signal: AbortSignal.timeout(10_000),
      });

      if (!tokenResp.ok || !isJsonResponse(tokenResp)) return; // 401 = not logged in, 429 = rate limited

      const tokenData = await tokenResp.json();
      const token = tokenData?.data?.token;

      // Validate token: non-empty string within a sane length bound (INPUT-2)
      if (typeof token !== 'string' || token.length === 0 || token.length > MAX_TOKEN_LENGTH) return;

      await browser.storage.session.set({
        [STORAGE_KEYS.token]:      token,
        [STORAGE_KEYS.acquiredAt]: Date.now(),
        [STORAGE_KEYS.expiresIn]:  tokenData.data.expires_in ?? 600,
      });
    } finally {
      // Always release the lock so the next page load can retry if needed
      await browser.storage.session.remove(STORAGE_KEYS.acquiring);
    }
  },
});
