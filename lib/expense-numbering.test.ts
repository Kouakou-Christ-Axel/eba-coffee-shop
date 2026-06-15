import { describe, it, expect } from 'vitest';
import { receiptPeriodFromDate, formatReceiptNo } from './expense-numbering';
import { parseDateOnlyToUTC } from './timezone';

describe('receiptPeriodFromDate', () => {
  it('extrait le mois civil "YYYY-MM" d’une date @db.Date', () => {
    expect(receiptPeriodFromDate(parseDateOnlyToUTC('2026-06-15')!)).toBe(
      '2026-06'
    );
  });

  it('zéro-pad le mois', () => {
    expect(receiptPeriodFromDate(parseDateOnlyToUTC('2026-01-03')!)).toBe(
      '2026-01'
    );
  });

  it('rattache le 1er du mois au bon mois (minuit UTC, pas de glissement)', () => {
    expect(receiptPeriodFromDate(parseDateOnlyToUTC('2026-12-01')!)).toBe(
      '2026-12'
    );
  });
});

describe('formatReceiptNo', () => {
  it('formate DEP-YYYY-MM-NNNN avec padding à 4 chiffres', () => {
    expect(formatReceiptNo('2026-06', 1)).toBe('DEP-2026-06-0001');
    expect(formatReceiptNo('2026-06', 42)).toBe('DEP-2026-06-0042');
  });

  it('ne tronque pas au-delà de 4 chiffres', () => {
    expect(formatReceiptNo('2026-06', 12345)).toBe('DEP-2026-06-12345');
  });
});
