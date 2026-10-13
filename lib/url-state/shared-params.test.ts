import { describe, it, expect } from 'vitest';
import { createLoader } from 'nuqs/server';
import {
  dateRangeParsers,
  pageParser,
  rangeChangeToParams,
} from './shared-params';

describe('rangeChangeToParams', () => {
  it('« Tout » retire les bornes, pose range=all et repasse à la page 1', () => {
    expect(rangeChangeToParams({ all: true })).toEqual({
      page: null,
      range: 'all',
      from: null,
      to: null,
    });
  });

  it('une plage retire range et écrit les deux bornes', () => {
    expect(
      rangeChangeToParams({ from: '2026-05-10', to: '2026-05-12' })
    ).toEqual({
      page: null,
      range: null,
      from: '2026-05-10',
      to: '2026-05-12',
    });
  });

  it("n'écrit pas une borne absente", () => {
    expect(rangeChangeToParams({ from: '2026-05-10' })).toEqual({
      page: null,
      range: null,
      from: '2026-05-10',
    });
  });
});

describe('parseurs partagés', () => {
  const load = createLoader({ page: pageParser, ...dateRangeParsers });

  it('applique les défauts', () => {
    expect(load({})).toEqual({ page: 1, from: null, to: null, range: null });
  });

  it('ignore une page ou un range invalide', () => {
    const r = load({ page: 'abc', range: 'semaine' });
    expect(r.page).toBe(1);
    expect(r.range).toBeNull();
  });

  it('lit une page, une plage et range=all', () => {
    expect(
      load({ page: '3', from: '2026-05-10', to: '2026-05-12', range: 'all' })
    ).toEqual({
      page: 3,
      from: '2026-05-10',
      to: '2026-05-12',
      range: 'all',
    });
  });
});
