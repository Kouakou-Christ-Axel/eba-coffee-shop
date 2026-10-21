import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  holdCreditForOrder,
  restoreOrderCredit,
  setOrderCredit,
} from './spend';

const tx = {
  $queryRaw: vi.fn(),
  customer: { update: vi.fn() },
  customerCreditEntry: { create: vi.fn(), findMany: vi.fn() },
  creditSettings: { findUnique: vi.fn() },
  order: { update: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
};
const txWithEntries = tx as typeof tx & {
  customerCreditEntry: { create: unknown; findMany: ReturnType<typeof vi.fn> };
};
const base = {
  orderId: 'o1',
  customerId: 'cu1',
  total: 5000,
  current: 0,
  actorId: 'u1',
};
const run = (over: Partial<typeof base & { wanted: number }>) =>
  setOrderCredit(tx as never, { ...base, wanted: 0, ...over });

describe('setOrderCredit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.creditSettings.findUnique.mockResolvedValue(null); // défauts 1500 / 70 %
    tx.$queryRaw.mockResolvedValue([{ creditBalance: 4000 }]);
  });

  it('débite l’avoir demandé et le retient sur la commande', async () => {
    await run({ wanted: 3000 });
    expect(tx.customer.update).toHaveBeenCalledWith({
      where: { id: 'cu1' },
      data: { creditBalance: 1000 },
    });
    expect(tx.customerCreditEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ kind: 'SPENT', delta: -3000 }),
    });
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: { creditApplied: 3000 },
    });
  });

  it('refuse plus que la règle ne le permet (reste minimum / plafond %)', async () => {
    // total 5000 → min(4000, 3500, 3500) = 3500
    await expect(run({ wanted: 3501 })).rejects.toThrow(/dépasser 3500/);
    expect(tx.customer.update).not.toHaveBeenCalled();
  });

  it('refuse sans client sur la commande', async () => {
    await expect(run({ customerId: null, wanted: 1000 })).rejects.toThrow(
      /Aucun client/
    );
  });

  it('ne fait rien quand l’avoir retenu est déjà le bon (commande en ligne)', async () => {
    await run({ current: 3000, wanted: 3000 });
    expect(tx.customer.update).not.toHaveBeenCalled();
    expect(tx.order.update).not.toHaveBeenCalled();
  });

  it('rend le trop-perçu quand on demande moins que retenu', async () => {
    await run({ current: 3000, wanted: 1000 });
    expect(tx.customerCreditEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ kind: 'RESTORED', delta: 2000 }),
    });
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: { creditApplied: 1000 },
    });
  });
});

describe('restoreOrderCredit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.$queryRaw.mockResolvedValue([{ creditBalance: 500 }]);
  });

  it('rend tout l’avoir retenu et remet la commande à 0', async () => {
    tx.order.findUnique.mockResolvedValue({
      customerId: 'cu1',
      creditApplied: 2000,
      total: 5000,
    });
    await expect(restoreOrderCredit(tx as never, 'o1')).resolves.toBe(2000);
    expect(tx.customer.update).toHaveBeenCalledWith({
      where: { id: 'cu1' },
      data: { creditBalance: 2500 },
    });
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: { creditApplied: 0 },
    });
  });

  it('idempotent : rien de retenu → rien ne bouge', async () => {
    tx.order.findUnique.mockResolvedValue({
      customerId: 'cu1',
      creditApplied: 0,
      total: 5000,
    });
    await expect(restoreOrderCredit(tx as never, 'o1')).resolves.toBe(0);
    expect(tx.customer.update).not.toHaveBeenCalled();
  });
});

describe('holdCreditForOrder (paiement en ligne)', () => {
  const args = { orderId: 'o1', customerId: 'cu1', total: 5000 };

  beforeEach(() => {
    vi.clearAllMocks();
    tx.$queryRaw.mockResolvedValue([{ creditBalance: 4000 }]);
    txWithEntries.customerCreditEntry.findMany.mockResolvedValue([]);
  });

  it('usage en ligne coupé (défaut) : rien n’est retenu, le solde n’est pas touché', async () => {
    tx.creditSettings.findUnique.mockResolvedValue(null);
    await expect(holdCreditForOrder(tx as never, args)).resolves.toBe(0);
    expect(tx.customer.update).not.toHaveBeenCalled();
  });

  it('activé : retient la part autorisée', async () => {
    tx.creditSettings.findUnique.mockResolvedValue({
      onlineEnabled: true,
      onlineDailyCap: 5000,
    });
    await expect(holdCreditForOrder(tx as never, args)).resolves.toBe(3500);
  });

  it('activé : le plafond journalier borne la retenue', async () => {
    tx.creditSettings.findUnique.mockResolvedValue({
      onlineEnabled: true,
      onlineDailyCap: 2000,
    });
    await expect(holdCreditForOrder(tx as never, args)).resolves.toBe(2000);
  });
});
