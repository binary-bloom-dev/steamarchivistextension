export const API_BASE = 'https://steamarchivist.com';
export const STEAM_HISTORY_URL = 'https://store.steampowered.com/account/history';
export const STEAM_AJAX_URL = 'https://store.steampowered.com/account/AjaxLoadMoreHistory/';

// Rate limiting — Steam doesn't publish limits, but 1s between requests
// is conservative enough to avoid triggering their anti-scraping measures.
export const PAGINATION_DELAY_MS = 1000;
export const MAX_RETRIES = 3;
export const RETRY_BASE_DELAY_MS = 2000;

export const PARSER_VERSION = '1.0.0';
