export const API_BASE = 'https://steamarchivist.com';
export const STEAM_HISTORY_URL = 'https://store.steampowered.com/account/history';
export const STEAM_AJAX_URL = 'https://store.steampowered.com/account/AjaxLoadMoreHistory/';

// Rate limiting — Steam doesn't publish limits, but 1s between requests
// is conservative enough to avoid triggering their anti-scraping measures.
export const PAGINATION_DELAY_MS = 1000;
export const MAX_RETRIES = 3;
export const RETRY_BASE_DELAY_MS = 2000;

export const PARSER_VERSION = '1.0.0';

// Maximum acceptable length for an API-issued extension token (INPUT-2).
// Prevents an oversized token from being stored in session storage or
// sent as an Authorization header that exceeds server/browser limits.
export const MAX_TOKEN_LENGTH = 512;

// Namespaced session storage keys — prevents collisions with other extensions
// or future features that might use the same plain-string keys.
// Write access: site-bridge (token write), background (token clear)
// Read access: content, background, popup (read-only)
export const STORAGE_KEYS = {
  token:      'sa:token',
  acquiredAt: 'sa:acquired_at',
  expiresIn:  'sa:expires_in',
  acquiring:  'sa:acquiring', // mutex flag: prevents multi-tab acquisition races
} as const;
