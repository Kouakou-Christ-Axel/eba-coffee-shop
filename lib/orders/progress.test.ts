import { describe, expect, it } from 'vitest';
import { getNextAction, getOrderProgress } from './progress';

const states = (status: Parameters<typeof getOrderProgress>[0]['status']) =>
  getOrderProgress({ status }).steps.map((s) => s.state);

describe('getOrderProgress', () => {
  it('marque l’étape courante et les précédentes', () => {
    expect(states('NEW')).toEqual(['current', 'todo', 'todo', 'todo']);
    expect(states('PREPARING')).toEqual(['done', 'current', 'todo', 'todo']);
    expect(states('READY')).toEqual(['done', 'done', 'current', 'todo']);
  });

  it('une commande récupérée est entièrement faite', () => {
    expect(states('COMPLETED')).toEqual(['done', 'done', 'done', 'done']);
  });

  it('une commande annulée grise toute la frise', () => {
    const p = getOrderProgress({ status: 'CANCELLED' });
    expect(p.cancelled).toBe(true);
    expect(p.steps.every((s) => s.state === 'todo')).toBe(true);
  });
});

describe('getNextAction', () => {
  const base = { status: 'NEW', isPaid: false, pickupTime: null } as const;

  it('non payée : acompte puis encaissement', () => {
    expect(getNextAction(base, { needsDeposit: true })).toBe('deposit');
    expect(getNextAction(base, { needsDeposit: false })).toBe('pay');
  });

  it('ardoise en cuisine : l’encaissement reste l’action principale', () => {
    expect(
      getNextAction({ ...base, status: 'PREPARING' }, { needsDeposit: false })
    ).toBe('pay');
  });

  it('programmée déjà payée : lancer la préparation', () => {
    expect(
      getNextAction(
        { status: 'NEW', isPaid: true, pickupTime: new Date() },
        { needsDeposit: false }
      )
    ).toBe('start-preparation');
  });

  it('payée : suit le statut', () => {
    const paid = { isPaid: true, pickupTime: null } as const;
    expect(
      getNextAction({ ...paid, status: 'PREPARING' }, { needsDeposit: false })
    ).toBe('mark-ready');
    expect(
      getNextAction({ ...paid, status: 'READY' }, { needsDeposit: false })
    ).toBe('mark-completed');
    expect(
      getNextAction({ ...paid, status: 'COMPLETED' }, { needsDeposit: false })
    ).toBeNull();
  });

  it('annulée : aucune action', () => {
    expect(
      getNextAction({ ...base, status: 'CANCELLED' }, { needsDeposit: false })
    ).toBeNull();
  });
});
