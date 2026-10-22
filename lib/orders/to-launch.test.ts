import { describe, expect, it } from 'vitest';
import { selectToLaunchToday } from './to-launch';

const now = new Date('2026-10-22T10:00:00Z');
const at = (iso: string) => new Date(iso);

const order = (
  id: string,
  over: Partial<{
    isPaid: boolean;
    status: 'NEW' | 'PREPARING';
    pickupTime: Date | null;
    state: 'full' | 'partial' | 'none';
  }> = {}
) => ({
  id,
  status: over.status ?? ('NEW' as const),
  isPaid: over.isPaid ?? true,
  pickupTime:
    over.pickupTime === undefined
      ? at('2026-10-22T15:00:00Z')
      : over.pickupTime,
  stockHold: over.state ? { state: over.state } : undefined,
});

describe('selectToLaunchToday', () => {
  it('range les commandes entièrement réservées dans « prêtes », les autres dans « en attente »', () => {
    const res = selectToLaunchToday(
      [
        order('a', { state: 'full' }),
        order('b', { state: 'partial' }),
        order('c', { state: 'none' }),
        order('d'),
      ],
      now
    );
    expect(res.ready.map((o) => o.id)).toEqual(['a']);
    expect(res.waiting.map((o) => o.id)).toEqual(['b', 'c', 'd']);
  });

  it('ignore les impayées, les autres jours et les commandes déjà lancées', () => {
    const res = selectToLaunchToday(
      [
        order('impayee', { isPaid: false, state: 'full' }),
        order('demain', {
          pickupTime: at('2026-10-23T12:00:00Z'),
          state: 'full',
        }),
        order('lancee', { status: 'PREPARING', state: 'full' }),
        order('sans-creneau', { pickupTime: null, state: 'full' }),
      ],
      now
    );
    expect(res.ready).toEqual([]);
    expect(res.waiting).toEqual([]);
  });

  it('trie par heure de retrait', () => {
    const res = selectToLaunchToday(
      [
        order('tard', {
          pickupTime: at('2026-10-22T18:00:00Z'),
          state: 'full',
        }),
        order('tot', { pickupTime: at('2026-10-22T12:00:00Z'), state: 'full' }),
      ],
      now
    );
    expect(res.ready.map((o) => o.id)).toEqual(['tot', 'tard']);
  });

  it('signale l’urgence quand le retrait est dans moins de 30 minutes', () => {
    const soon = at('2026-10-22T10:20:00Z');
    expect(
      selectToLaunchToday(
        [order('a', { pickupTime: soon, state: 'full' })],
        now
      ).urgent
    ).toBe(true);
    const late = selectToLaunchToday(
      [order('b', { pickupTime: soon, state: 'none' })],
      now
    );
    expect(late.urgent).toBe(false);
    expect(late.lateWaiting).toBe(true);
  });
});
