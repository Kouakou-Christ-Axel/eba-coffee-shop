import { describe, expect, it } from 'vitest';
import { parseRefundsSearchParams } from './parse-search-params';

describe('parseRefundsSearchParams', () => {
  it('onglet par défaut : à valider, sans plage de dates', () => {
    const r = parseRefundsSearchParams({});
    expect(r.tab).toBe('validate');
    expect(r.status).toEqual(['REQUESTED']);
    expect(r.from).toBeUndefined();
    expect(r.toExclusive).toBeUndefined();
    expect(r.page).toBe(1);
  });

  it.each([
    ['fix', ['FAILED', 'UNCERTAIN']],
    ['progress', ['APPROVED', 'PROCESSING']],
    ['history', ['PAID', 'REJECTED', 'CANCELLED']],
  ])('onglet %s → statuts attendus', (tab, statuses) => {
    expect(parseRefundsSearchParams({ tab }).status).toEqual(statuses);
  });

  it('valeur inconnue : retombe sur les défauts des deux côtés', () => {
    const r = parseRefundsSearchParams({ tab: 'nimporte', channel: 'BITCOIN' });
    expect(r.tab).toBe('validate');
    expect(r.channel).toBeUndefined();
  });

  it('la plage de dates ne s’applique qu’à l’historique, borne de fin inclusive', () => {
    const files = parseRefundsSearchParams({
      tab: 'fix',
      from: '2026-10-01',
      to: '2026-10-03',
    });
    expect(files.from).toBeUndefined();

    const h = parseRefundsSearchParams({
      tab: 'history',
      from: '2026-10-01',
      to: '2026-10-03',
    });
    expect(h.from).toEqual(new Date(Date.UTC(2026, 9, 1)));
    expect(h.toExclusive).toEqual(new Date(Date.UTC(2026, 9, 4)));
    expect(h.isAll).toBe(false);
  });

  it('historique sans dates ou « tout » : pas de filtre', () => {
    expect(parseRefundsSearchParams({ tab: 'history' }).isAll).toBe(true);
    const all = parseRefundsSearchParams({
      tab: 'history',
      range: 'all',
      from: '2026-10-01',
    });
    expect(all.from).toBeUndefined();
  });

  it('page invalide ou négative → 1', () => {
    expect(parseRefundsSearchParams({ page: '-4' }).page).toBe(1);
    expect(parseRefundsSearchParams({ page: '3' }).page).toBe(3);
  });
});
