import type { ParsedTransaction } from './types';

const FORMULA_CHARS = new Set(['=', '+', '-', '@']);
const HEADERS = ['Date', 'Game', 'Amount', 'Type'];

// Currencies with no minor unit (zero decimal places)
const ZERO_DECIMAL_CURRENCIES = new Set(['JPY', 'KRW', 'IDR', 'VND', 'CLP', 'ISK']);

/**
 * Escape a cell value for CSV output.
 * Prevents formula injection by prepending a tab character to cells
 * that start with characters Excel/Sheets interpret as formulas.
 */
function escapeCell(value: string): string {
  const escaped = value.replace(/"/g, '""');
  if (escaped.length > 0 && FORMULA_CHARS.has(escaped[0])) {
    return `"\t${escaped}"`;
  }
  return `"${escaped}"`;
}

/**
 * Build a CSV string from parsed transactions.
 * Column order matches what the SteamArchivist CSV parser expects.
 */
export function buildCsv(transactions: ParsedTransaction[]): string {
  // Pre-size to avoid repeated array resizing (PERF-SP-2).
  const lines = new Array<string>(transactions.length + 1);
  lines[0] = HEADERS.join(',');

  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];
    const decimals = ZERO_DECIMAL_CURRENCIES.has(tx.currency) ? 0 : 2;
    const price = tx.amount !== 0
      ? `${tx.currency} ${tx.amount.toFixed(decimals)}`
      : 'Free';

    // Template literal avoids a per-row temporary array (PERF-SP-1).
    lines[i + 1] = `${escapeCell(tx.date)},${escapeCell(tx.gameName)},${escapeCell(price)},${escapeCell(tx.type)}`;
  }

  // RFC 4180 specifies CRLF as the line terminator for CSV files.
  return lines.join('\r\n');
}

/**
 * Trigger a CSV file download in the browser.
 */
export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();

  // Cleanup after a short delay to ensure the download starts
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
}
