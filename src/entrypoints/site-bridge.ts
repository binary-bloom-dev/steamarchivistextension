/**
 * Content script that runs on steamarchivist.com pages.
 *
 * Automatically acquires a single-use extension token when the user is logged in.
 * The token is stored in session storage (cleared on browser close) and used by
 * the Steam content script to authenticate API submissions.
 *
 * This avoids any manual linking step — the extension "just works" once installed.
 */

export default defineContentScript({
  matches: ['https://steamarchivist.com/*'],
  runAt: 'document_idle',

  async main() {
    const stored = await browser.storage.session.get('token');
    if (stored.token) return;

    try {
      // Fetch CSRF token first — needed for the POST request.
      // Cookies are included automatically since this script runs in the page's origin.
      const csrfResp = await fetch('/auth/csrf', { credentials: 'include' });
      if (!csrfResp.ok) return;

      const csrfData = await csrfResp.json();
      const csrfToken = csrfData?.data?.csrf_token;
      if (!csrfToken) return;

      const tokenResp = await fetch('/api/v1/extension/token', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
      });

      if (!tokenResp.ok) return; // 401 = not logged in, 429 = rate limited

      const tokenData = await tokenResp.json();
      const token = tokenData?.data?.token;

      if (token) {
        await browser.storage.session.set({
          token,
          acquired_at: Date.now(),
          expires_in: tokenData.data.expires_in ?? 600,
        });
      }
    } catch {
      // Network error or not logged in — silently ignore.
      // The script retries on every steamarchivist.com page load.
    }
  },
});
