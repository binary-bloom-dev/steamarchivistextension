import { describe, it, expect } from 'vitest';
import { buildCsv } from '../src/lib/csv';
import type { ParsedTransaction } from '../src/lib/types';

function tx(overrides: Partial<ParsedTransaction> = {}): ParsedTransaction {
  return {
    date: 'Jan 15, 2020',
    gameName: 'Test Game',
    appId: 12345,
    type: 'Purchase',
    currency: 'USD',
    amount: 9.99,
    ...overrides,
  };
}

describe('buildCsv', () => {
  it('includes the header row', () => {
    const csv = buildCsv([]);
    expect(csv).toBe('Date,Game,Amount,Type');
  });

  it('formats a basic transaction', () => {
    const csv = buildCsv([tx()]);
    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe('"Jan 15, 2020","Test Game","USD 9.99","Purchase"');
  });

  it('formats free items', () => {
    const csv = buildCsv([tx({ amount: 0 })]);
    const lines = csv.split('\r\n');
    expect(lines[1]).toContain('"Free"');
  });

  it('handles game names with quotes', () => {
    const csv = buildCsv([tx({ gameName: 'The "Best" Game' })]);
    expect(csv).toContain('"The ""Best"" Game"');
  });

  it('prevents formula injection with = prefix', () => {
    const csv = buildCsv([tx({ gameName: '=HYPERLINK("evil")' })]);
    // Should be tab-prefixed inside quotes
    expect(csv).toContain('"\t=HYPERLINK(""evil"")"');
  });

  it('prevents formula injection with + prefix', () => {
    const csv = buildCsv([tx({ gameName: '+cmd|stuff' })]);
    expect(csv).toContain('"\t+cmd|stuff"');
  });

  it('prevents formula injection with - prefix', () => {
    const csv = buildCsv([tx({ gameName: '-1+1' })]);
    expect(csv).toContain('"\t-1+1"');
  });

  it('prevents formula injection with @ prefix', () => {
    const csv = buildCsv([tx({ gameName: '@SUM(A1:A10)' })]);
    expect(csv).toContain('"\t@SUM(A1:A10)"');
  });

  it('handles multiple transactions', () => {
    const csv = buildCsv([
      tx({ gameName: 'Game A', amount: 9.99 }),
      tx({ gameName: 'Game B', amount: 19.99 }),
      tx({ gameName: 'Game C', amount: 0 }),
    ]);
    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(4); // header + 3 rows
  });

  it('handles special characters in game names', () => {
    const csv = buildCsv([tx({ gameName: 'Nier: Automata™' })]);
    expect(csv).toContain('Nier: Automata™');
  });

  it('formats negative amounts for refunds', () => {
    const csv = buildCsv([tx({ amount: -9.99 })]);
    const lines = csv.split('\r\n');
    expect(lines[1]).toContain('"USD -9.99"');
  });
});
