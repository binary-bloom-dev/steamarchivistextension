import type { ParsedTransaction } from './types';

const FORMULA_CHARS = new Set(['=', '+', '-', '@']);
const HEADERS = ['Date', 'Game', 'Price', 'Type'];

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
  const lines = [HEADERS.join(',')];

  for (const tx of transactions) {
    const price = tx.amount !== 0
      ? `${tx.currency} ${tx.amount.toFixed(2)}`
      : 'Free';

    lines.push([
      escapeCell(tx.date),
      escapeCell(tx.gameName),
      escapeCell(price),
      escapeCell(tx.type),
    ].join(','));
  }

  return lines.join('\n');
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
