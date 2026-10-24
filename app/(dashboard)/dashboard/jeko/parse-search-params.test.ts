import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseJekoSearchParams } from './parse-search-params';

describe('parseJekoSearchParams', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-23T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('défaut : tous les comptes, du 1er du mois à aujourd’hui', () => {
    expect(parseJekoSearchParams({})).toMatchObject({
      account: null,
      isAll: false,
      fromStr: '2026-10-01',
      toStr: '2026-10-23',
    });
  });

  it('retient un compte valide, ignore un compte inconnu', () => {
    expect(parseJekoSearchParams({ account: 'B' }).account).toBe('B');
    expect(parseJekoSearchParams({ account: 'C' }).account).toBeNull();
  });

  it('plage valide gardée, bornes inversées remises dans l’ordre, date invalide ignorée', () => {
    expect(
      parseJekoSearchParams({ from: '2026-09-10', to: '2026-09-20' })
    ).toMatchObject({ fromStr: '2026-09-10', toStr: '2026-09-20' });
    expect(
      parseJekoSearchParams({ from: '2026-09-20', to: '2026-09-10' })
    ).toMatchObject({ fromStr: '2026-09-10', toStr: '2026-09-20' });
    expect(parseJekoSearchParams({ from: 'nope' })).toMatchObject({
      fromStr: '2026-10-01',
    });
  });

  it('range=all : drapeau levé, bornes laissées à l’appelant', () => {
    expect(parseJekoSearchParams({ range: 'all' })).toMatchObject({
      isAll: true,
      toStr: '2026-10-23',
    });
  });
});
