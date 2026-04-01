import type { ParsedTransaction } from './types';

// Currency symbols mapped to ISO 4217 codes.
// Covers the major currencies Steam uses across regions.
const CURRENCY_MAP: Record<string, string> = {
  '$': 'USD',
  '€': 'EUR',
  '£': 'GBP',
  '¥': 'JPY',
  '₹': 'INR',
  'R$': 'BRL',
  '₽': 'RUB',
  'A$': 'AUD',
  'CA$': 'CAD',
  'NZ$': 'NZD',
  'S$': 'SGD',
  'HK$': 'HKD',
  '₩': 'KRW',
  '₺': 'TRY',
  'zł': 'PLN',
  'kr': 'NOK', // also SEK/DKK — ambiguous; NOK chosen as most common on Steam
  'CHF': 'CHF',
  '₱': 'PHP',
  '฿': 'THB',
  'RM': 'MYR',
  'Rp': 'IDR',
};

// Sorted longest-first so "CA$" matches before "$", etc. Computed once at module load.
const CURRENCY_PREFIXES = Object.keys(CURRENCY_MAP).sort((a, b) => b.length - a.length);

/**
 * Parse a price string like "$59.99" or "€19,99" into amount + currency.
 * Returns null for unparseable values (free items, blank cells, etc).
 */
export function parsePrice(raw: string): { amount: number; currency: string } | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.toLowerCase() === 'free') return null;

  // Try each known currency prefix, longest first to avoid partial matches
  const prefixes = CURRENCY_PREFIXES;

  for (const prefix of prefixes) {
    if (trimmed.startsWith(prefix)) {
      const rest = trimmed.slice(prefix.length).trim();
      const amount = parseAmount(rest);
      if (amount !== null) return { amount, currency: CURRENCY_MAP[prefix] };
    }
  }

  // Some currencies appear as suffixes (e.g., "19,99 €")
  for (const suffix of prefixes) {
    if (trimmed.endsWith(suffix)) {
      const rest = trimmed.slice(0, -suffix.length).trim();
      const amount = parseAmount(rest);
      if (amount !== null) return { amount, currency: CURRENCY_MAP[suffix] };
    }
  }

  // Fallback: try to find any numeric value, default to USD
  const amount = parseAmount(trimmed);
  if (amount !== null) return { amount, currency: 'USD' };

  return null;
}

/**
 * Parse a numeric amount string, handling both "1,234.56" (US) and "1.234,56" (European) formats.
 *
 * Disambiguation rule: a comma is a decimal separator only when exactly 2 digits follow it
 * AND it appears after any period (or there is no period). Otherwise it is a thousands separator.
 * This correctly handles "1,234" (US $1234) vs "19,99" (EU €19.99).
 */
function parseAmount(raw: string): number | null {
  let cleaned = raw.replace(/[^\d.,-]/g, '');
  if (!cleaned) return null;

  const isNegative = cleaned.startsWith('-');
  if (isNegative) cleaned = cleaned.slice(1);

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot   = cleaned.lastIndexOf('.');

  // European decimal: comma present, comes after any dot (or no dot), with exactly 2 trailing digits
  const isEuropeanDecimal =
    lastComma !== -1 &&
    (lastComma > lastDot || lastDot === -1) &&
    cleaned.length - lastComma - 1 === 2;

  if (isEuropeanDecimal) {
    // Strip thousands dots, then convert decimal comma to dot
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    // US format: commas are thousands separators
    cleaned = cleaned.replace(/,/g, '');
  }

  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;
  return isNegative ? -num : num;
}

/**
 * Extract the app ID from an anchor element's href.
 * Steam links look like: /app/546560/ or https://store.steampowered.com/app/546560/
 */
function extractAppId(anchor: Element | null): number | null {
  if (!anchor) return null;
  const href = anchor.getAttribute('href') ?? '';
  const match = href.match(/\/app\/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Parse a single transaction row from the Steam purchase history table.
 * Each row contains: date, item name(s), transaction type, and total price.
 */
export function parseTransactionRow(row: Element): ParsedTransaction | null {
  const dateEl = row.querySelector('.wht_date');
  const itemsEl = row.querySelector('.wht_items');
  const typeEl = row.querySelector('.wht_type');
  const totalEl = row.querySelector('.wht_total');

  if (!dateEl || !itemsEl || !typeEl || !totalEl) return null;

  const date = dateEl.textContent?.trim() ?? '';
  const type = typeEl.textContent?.trim() ?? '';
  const totalText = totalEl.textContent?.trim() ?? '';

  if (!date || !type) return null;

  // Item name: use the first link text, or fall back to full text
  const anchor = itemsEl.querySelector('a');
  const gameName = (anchor?.textContent ?? itemsEl.textContent ?? '').trim();
  const appId = extractAppId(anchor);

  if (!gameName) return null;

  const price = parsePrice(totalText);

  return {
    date,
    gameName,
    appId,
    type,
    currency: price?.currency ?? 'USD',
    amount: price?.amount ?? 0,
  };
}

/**
 * Parse all transaction rows from a DOM container (page fragment or full page).
 * Skips rows that can't be parsed rather than failing the whole batch.
 */
export function parseTransactionRows(container: Element | Document): ParsedTransaction[] {
  const rows = container.querySelectorAll('.wallet_table_row');
  const results: ParsedTransaction[] = [];

  for (const row of rows) {
    const parsed = parseTransactionRow(row);
    if (parsed) results.push(parsed);
  }

  return results;
}
