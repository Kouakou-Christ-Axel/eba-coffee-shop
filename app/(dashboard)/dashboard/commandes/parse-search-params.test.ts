import { describe, it, expect } from 'vitest';
import { parseOrdersSearchParams } from './parse-search-params';

describe('parseOrdersSearchParams (nuqs)', () => {
  it('applique les défauts sans paramètre', () => {
    const r = parseOrdersSearchParams({});
    expect(r.page).toBe(1);
    expect(r.sort).toBe('recent');
    expect(r.status).toBeUndefined();
    expect(r.payment).toBeUndefined();
    expect(r.isAll).toBe(false);
    expect(r.fromStr).toBe(r.today);
    expect(r.toStr).toBe(r.today);
  });

  it('ignore les valeurs invalides', () => {
    const r = parseOrdersSearchParams({
      status: 'PENDING',
      payment: 'bitcoin',
      sort: 'zigzag',
      page: 'abc',
      from: 'pas-une-date',
    });
    expect(r.status).toBeUndefined();
    expect(r.payment).toBeUndefined();
    expect(r.sort).toBe('recent');
    expect(r.page).toBe(1);
    expect(r.fromStr).toBe(r.today);
  });

  it('lit les filtres valides et borne la page à 1', () => {
    const r = parseOrdersSearchParams({
      status: 'READY',
      payment: 'unpaid',
      sort: 'total_desc',
      page: '-3',
      search: '  kofi ',
      from: '2026-05-10',
      to: '2026-05-12',
    });
    expect(r).toMatchObject({
      status: 'READY',
      payment: 'unpaid',
      sort: 'total_desc',
      page: 1,
      search: 'kofi',
      fromStr: '2026-05-10',
      toStr: '2026-05-12',
    });
  });

  it('range=all désactive le filtre de dates', () => {
    const r = parseOrdersSearchParams({ range: 'all', from: '2026-05-10' });
    expect(r.isAll).toBe(true);
    expect(r.dateFrom).toBeUndefined();
    expect(r.dateTo).toBeUndefined();
  });

  it('aligne la borne haute si elle précède la borne basse', () => {
    const r = parseOrdersSearchParams({ from: '2026-05-12', to: '2026-05-10' });
    expect(r.toStr).toBe('2026-05-12');
  });
});
