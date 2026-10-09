import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/order-mutations', async () =>
  (await import('./settle.test-errors')).orderMutationsModuleMock()
);
vi.mock('@/lib/prisma', () => ({
  default: { order: { findUnique: vi.fn(), updateMany: vi.fn() } },
}));
vi.mock('@/lib/push-notify', () => ({ sendPushToRoles: vi.fn() }));
vi.mock('./notify-paid', () => ({ announcePaidOrder: vi.fn() }));
vi.mock('@/lib/auth-helpers', () => ({
  ROLE_GROUPS: { CASHIER_PLUS: ['CASHIER', 'MANAGER', 'ADMIN'] },
}));

import { settleJekoTransaction } from './settle';
import {
  findOrder,
  updateOrder,
  pay,
  push,
  announce,
  order,
  tx,
  online,
  setupSettleMocks,
} from './settle.test-utils';
import { OrderMutationError } from './settle.test-errors';

describe('settleJekoTransaction — courses et rejeux', () => {
  beforeEach(setupSettleMocks);

  it('compare au montant FIGÉ de la tentative, pas à total + frais recalculé (annulation client)', async () => {
    // Le client a annulé : `total` est repassé au prix brut (3 500) alors que les
    // frais avaient été calculés sur le net. Il paie quand même sur l'onglet Jèko
    // encore ouvert : 3 485 F, exactement ce qui lui a été demandé.
    findOrder.mockResolvedValue({
      ...order,
      status: 'CANCELLED',
      total: 3500,
    } as never);

    await expect(settleJekoTransaction(tx)).resolves.toBe('late_payment');

    expect(pay).toHaveBeenCalledWith(
      'o1',
      true,
      [{ mode: 'WAVE', amount: 3500 }],
      null,
      { online }
    );
  });

  it("retombe sur total + frais quand aucun montant n'a été figé", async () => {
    findOrder.mockResolvedValue({ ...order, paymentAmountDue: null } as never);
    await expect(settleJekoTransaction(tx)).resolves.toBe('paid');
  });

  it("sort la commande de l'attente sur un montant erroné, sinon l'expiration la reprend à l'infini", async () => {
    await expect(
      settleJekoTransaction({ ...tx, amountFcfa: 3450 })
    ).resolves.toBe('amount_mismatch');

    expect(updateOrder).toHaveBeenCalledWith({
      where: { id: 'o1', isPaid: false, paymentExpiresAt: { not: null } },
      data: { paymentExpiresAt: null },
    });
  });

  it('un rejeu du montant erroné ne réalerte pas le staff', async () => {
    updateOrder.mockResolvedValue({ count: 0 } as never);
    await expect(
      settleJekoTransaction({ ...tx, amountFcfa: 3450 })
    ).resolves.toBe('amount_mismatch');
    expect(push).not.toHaveBeenCalled();
  });

  it('une commande dépayée par CETTE transaction n’est pas re-payée au rejeu', async () => {
    findOrder.mockResolvedValue({
      ...order,
      isPaid: false,
      paymentTransactionId: tx.transactionId,
    } as never);
    await expect(settleJekoTransaction(tx)).resolves.toBe('ignored');
    expect(pay).not.toHaveBeenCalled();
  });

  it('un second paiement par une AUTRE transaction sur une commande déjà payée alerte le staff', async () => {
    findOrder.mockResolvedValue({
      ...order,
      isPaid: true,
      paymentTransactionId: 'txn_premiere',
    } as never);

    await expect(settleJekoTransaction(tx)).resolves.toBe('duplicate_payment');

    expect(push).toHaveBeenCalledTimes(1);
    expect(pay).not.toHaveBeenCalled();
  });

  it('la même transaction livrée deux fois reste silencieuse', async () => {
    findOrder.mockResolvedValue({
      ...order,
      isPaid: true,
      paymentTransactionId: 'txn_1',
    } as never);

    await expect(settleJekoTransaction(tx)).resolves.toBe('already_paid');

    expect(push).not.toHaveBeenCalled();
    expect(updateOrder).not.toHaveBeenCalled();
  });

  it('payée hors Jèko (caisse, MCP) puis payée en ligne : alerte de double paiement', async () => {
    // `paymentTransactionId` nul sur une commande payée = encaissée par le staff.
    findOrder.mockResolvedValue({
      ...order,
      isPaid: true,
      paymentTransactionId: null,
    } as never);

    await expect(settleJekoTransaction(tx)).resolves.toBe('duplicate_payment');

    expect(push).toHaveBeenCalledTimes(1);
    expect(pay).not.toHaveBeenCalled();
    expect(updateOrder).not.toHaveBeenCalled();
  });

  it("encaissement du staff entre la lecture et l'écriture : alerte, pas de rejeu silencieux", async () => {
    pay.mockRejectedValue(
      new OrderMutationError('État de paiement déjà à jour', 409)
    );
    findOrder.mockResolvedValueOnce(order as never).mockResolvedValueOnce({
      ...order,
      isPaid: true,
      paymentTransactionId: null,
    } as never);

    await expect(settleJekoTransaction(tx)).resolves.toBe('duplicate_payment');
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("l'expiration annule la commande entre la lecture et l'écriture : on rejoue une fois, en paiement tardif", async () => {
    pay
      .mockRejectedValueOnce(
        new OrderMutationError('État modifié entre temps, recharger', 409)
      )
      .mockResolvedValueOnce({ startedPreparation: false });
    findOrder
      .mockResolvedValueOnce(order as never)
      .mockResolvedValueOnce({ ...order, status: 'CANCELLED' } as never);

    await expect(settleJekoTransaction(tx)).resolves.toBe('late_payment');

    expect(pay).toHaveBeenCalledTimes(2);
    expect(push).toHaveBeenCalledTimes(1);
    expect(announce).not.toHaveBeenCalled();
  });

  it('ne rejoue qu’une seule fois : un second 409 remonte pour que Jèko réessaie', async () => {
    pay.mockRejectedValue(
      new OrderMutationError('État modifié entre temps, recharger', 409)
    );
    findOrder.mockResolvedValue({ ...order, status: 'CANCELLED' } as never);

    await expect(settleJekoTransaction(tx)).rejects.toThrow('État modifié');
    expect(pay).toHaveBeenCalledTimes(2);
  });

  it('relance toute autre erreur pour que Jèko réessaie la livraison', async () => {
    pay.mockRejectedValue(new Error('connexion perdue'));
    await expect(settleJekoTransaction(tx)).rejects.toThrow('connexion perdue');
  });
});
