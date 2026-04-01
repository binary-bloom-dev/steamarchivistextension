import { describe, it, expect } from 'vitest';
import { parsePrice, parseTransactionRow, parseTransactionRows } from '../src/lib/parser';

function makeRow(date: string, name: string, href: string | null, type: string, total: string): Element {
  const row = document.createElement('tr');
  row.className = 'wallet_table_row';

  const dateCell = document.createElement('td');
  dateCell.className = 'wht_date';
  dateCell.textContent = date;

  const itemsCell = document.createElement('td');
  itemsCell.className = 'wht_items';
  if (href) {
    const a = document.createElement('a');
    a.href = href;
    a.textContent = name;
    itemsCell.appendChild(a);
  } else {
    itemsCell.textContent = name;
  }

  const typeCell = document.createElement('td');
  typeCell.className = 'wht_type';
  typeCell.textContent = type;

  const totalCell = document.createElement('td');
  totalCell.className = 'wht_total';
  totalCell.textContent = total;

  row.append(dateCell, itemsCell, typeCell, totalCell);
  return row;
}

describe('parsePrice', () => {
  it('parses USD prices', () => {
    expect(parsePrice('$59.99')).toEqual({ amount: 59.99, currency: 'USD' });
  });

  it('parses EUR prices with comma decimal', () => {
    expect(parsePrice('€19,99')).toEqual({ amount: 19.99, currency: 'EUR' });
  });

  it('parses GBP prices', () => {
    expect(parsePrice('£39.99')).toEqual({ amount: 39.99, currency: 'GBP' });
  });

  it('parses BRL prices', () => {
    expect(parsePrice('R$199,90')).toEqual({ amount: 199.90, currency: 'BRL' });
  });

  it('parses suffix currencies like "19,99 €"', () => {
    expect(parsePrice('19,99 €')).toEqual({ amount: 19.99, currency: 'EUR' });
  });

  it('handles thousands separators in US format', () => {
    expect(parsePrice('$1,234.56')).toEqual({ amount: 1234.56, currency: 'USD' });
  });

  it('handles European thousands separators', () => {
    expect(parsePrice('€1.234,56')).toEqual({ amount: 1234.56, currency: 'EUR' });
  });

  it('returns null for free items', () => {
    expect(parsePrice('Free')).toBeNull();
    expect(parsePrice('free')).toBeNull();
  });

  it('returns null for empty strings', () => {
    expect(parsePrice('')).toBeNull();
    expect(parsePrice('  ')).toBeNull();
  });

  it('handles negative amounts (refunds)', () => {
    expect(parsePrice('$-9.99')).toEqual({ amount: -9.99, currency: 'USD' });
  });

  it('parses JPY without decimals', () => {
    expect(parsePrice('¥980')).toEqual({ amount: 980, currency: 'JPY' });
  });

  it('parses INR', () => {
    expect(parsePrice('₹529')).toEqual({ amount: 529, currency: 'INR' });
  });
});

describe('parseTransactionRow', () => {
  it('parses a standard purchase row', () => {
    const row = makeRow('Jan 15, 2020', 'Half-Life: Alyx', '/app/546560/', 'Purchase', '$59.99');
    const result = parseTransactionRow(row);

    expect(result).toEqual({
      date: 'Jan 15, 2020',
      gameName: 'Half-Life: Alyx',
      appId: 546560,
      type: 'Purchase',
      currency: 'USD',
      amount: 59.99,
    });
  });

  it('parses a refund row', () => {
    const row = makeRow('Mar 1, 2023', 'Some Game', '/app/12345/', 'Refund', '$-19.99');
    const result = parseTransactionRow(row);

    expect(result).not.toBeNull();
    expect(result!.amount).toBe(-19.99);
    expect(result!.type).toBe('Refund');
  });

  it('handles rows without app links', () => {
    const row = makeRow('Dec 25, 2019', 'Steam Wallet Credit', null, 'Purchase', '$50.00');
    const result = parseTransactionRow(row);

    expect(result).not.toBeNull();
    expect(result!.appId).toBeNull();
    expect(result!.gameName).toBe('Steam Wallet Credit');
  });

  it('handles free items', () => {
    const row = makeRow('Apr 1, 2021', 'Free Game', '/app/99999/', 'Purchase', 'Free');
    const result = parseTransactionRow(row);

    expect(result).not.toBeNull();
    expect(result!.amount).toBe(0);
  });

  it('extracts app ID from full URL', () => {
    const row = makeRow('Jan 1, 2020', 'Test', 'https://store.steampowered.com/app/730/', 'Purchase', '$0.00');
    const result = parseTransactionRow(row);

    expect(result!.appId).toBe(730);
  });

  it('returns null for rows missing required cells', () => {
    const row = document.createElement('tr');
    row.className = 'wallet_table_row';
    expect(parseTransactionRow(row)).toBeNull();
  });

  it('returns null when date is empty', () => {
    const row = makeRow('', 'Test Game', '/app/1/', 'Purchase', '$9.99');
    expect(parseTransactionRow(row)).toBeNull();
  });

  it('returns null when type is empty', () => {
    const row = makeRow('Jan 1, 2020', 'Test Game', '/app/1/', '', '$9.99');
    expect(parseTransactionRow(row)).toBeNull();
  });
});

describe('parseTransactionRows', () => {
  it('parses multiple rows from a container', () => {
    const container = document.createElement('div');
    container.appendChild(makeRow('Jan 1, 2020', 'Game A', '/app/1/', 'Purchase', '$9.99'));
    container.appendChild(makeRow('Feb 2, 2020', 'Game B', '/app/2/', 'Purchase', '$19.99'));

    const results = parseTransactionRows(container);
    expect(results).toHaveLength(2);
    expect(results[0].gameName).toBe('Game A');
    expect(results[1].gameName).toBe('Game B');
  });

  it('skips unparseable rows without failing', () => {
    const container = document.createElement('div');
    container.appendChild(makeRow('Jan 1, 2020', 'Good Row', '/app/1/', 'Purchase', '$9.99'));

    // Add a broken row with no cells
    const broken = document.createElement('tr');
    broken.className = 'wallet_table_row';
    container.appendChild(broken);

    container.appendChild(makeRow('Mar 3, 2020', 'Also Good', '/app/3/', 'Purchase', '$29.99'));

    const results = parseTransactionRows(container);
    expect(results).toHaveLength(2);
  });

  it('returns empty array for container with no rows', () => {
    const container = document.createElement('div');
    expect(parseTransactionRows(container)).toEqual([]);
  });
});
