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
import { OrderMutationError, StockShortageError } from './settle.test-errors';

describe('settleJekoTransaction', () => {
  beforeEach(setupSettleMocks);

  it('encaisse le total des produits (sans les frais) et note les frais réels de Jèko', async () => {
    await expect(settleJekoTransaction(tx)).resolves.toBe('paid');

    expect(findOrder).toHaveBeenCalledWith(
      expect.objectContaining({ where: { reference: 'EBA-20261003-AB12' } })
    );
    expect(pay).toHaveBeenCalledWith(
      'o1',
      true,
      [{ mode: 'WAVE', amount: 3450 }],
      null,
      { online }
    );
    expect(updateOrder).not.toHaveBeenCalled();
  });

  it('enregistre le moyen réellement utilisé', async () => {
    await settleJekoTransaction({ ...tx, paymentMethod: 'mtn' });
    expect(pay).toHaveBeenCalledWith(
      'o1',
      true,
      [{ mode: 'MTN_MONEY', amount: 3450 }],
      null,
      { online }
    );
  });

  it('ne fait rien si la commande est déjà payée (webhook livré deux fois)', async () => {
    findOrder.mockResolvedValue({
      ...order,
      isPaid: true,
      paymentTransactionId: 'txn_1',
    } as never);
    await expect(settleJekoTransaction(tx)).resolves.toBe('already_paid');
    expect(pay).not.toHaveBeenCalled();
  });

  it("ignore une transaction qui n'est pas un succès, sans toucher à la base", async () => {
    await expect(
      settleJekoTransaction({ ...tx, status: 'pending' })
    ).resolves.toBe('ignored');
    expect(findOrder).not.toHaveBeenCalled();
  });

  it("ignore une référence qui n'est pas la nôtre ou une commande introuvable", async () => {
    await expect(
      settleJekoTransaction({ ...tx, reference: 'PAY-2024-001' })
    ).resolves.toBe('ignored');
    expect(findOrder).not.toHaveBeenCalled();

    findOrder.mockResolvedValue(null as never);
    await expect(settleJekoTransaction(tx)).resolves.toBe('ignored');
    expect(pay).not.toHaveBeenCalled();
  });

  it("ignore une commande qui n'a pas été créée pour un paiement en ligne", async () => {
    findOrder.mockResolvedValue({ ...order, onlineFee: null } as never);
    await expect(settleJekoTransaction(tx)).resolves.toBe('ignored');
    expect(pay).not.toHaveBeenCalled();
  });

  it("n'encaisse pas un montant différent du dû, et alerte le staff", async () => {
    await expect(
      settleJekoTransaction({ ...tx, amountFcfa: 3450 })
    ).resolves.toBe('amount_mismatch');
    expect(pay).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledTimes(1);
  });

  it('encaisse une commande déjà annulée ou expirée et alerte le staff', async () => {
    findOrder.mockResolvedValue({ ...order, status: 'CANCELLED' } as never);

    await expect(settleJekoTransaction(tx)).resolves.toBe('late_payment');

    expect(pay).toHaveBeenCalledWith(
      'o1',
      true,
      [{ mode: 'WAVE', amount: 3450 }],
      null,
      { online }
    );
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("enregistre quand même le paiement si le stock manque entre-temps : l'argent est arrivé, la commande reste à lancer par le staff", async () => {
    pay
      .mockRejectedValueOnce(new StockShortageError('Stock insuffisant'))
      .mockResolvedValueOnce({ startedPreparation: false });

    await expect(settleJekoTransaction(tx)).resolves.toBe('shortage');

    // 2e appel : encaissement purement financier, sans entrée en cuisine.
    expect(pay).toHaveBeenNthCalledWith(
      2,
      'o1',
      true,
      [{ mode: 'WAVE', amount: 3450 }],
      null,
      { online, skipKitchen: true }
    );
    expect(push).toHaveBeenCalledTimes(1);
  });

  it('traite comme déjà payée la course de deux livraisons simultanées', async () => {
    pay.mockRejectedValue(
      new OrderMutationError('État de paiement déjà à jour', 409)
    );
    findOrder.mockResolvedValueOnce(order as never).mockResolvedValueOnce({
      ...order,
      isPaid: true,
      paymentTransactionId: 'txn_1',
    } as never);

    await expect(settleJekoTransaction(tx)).resolves.toBe('already_paid');
  });

  it('annonce au staff une commande normale qui vient d’être payée', async () => {
    await settleJekoTransaction(tx);
    expect(announce).toHaveBeenCalledWith('o1');
  });

  it("n'annonce pas deux fois quand le règlement ne fait rien (déjà payée, ignorée)", async () => {
    findOrder.mockResolvedValue({
      ...order,
      isPaid: true,
      paymentTransactionId: 'txn_1',
    } as never);
    await settleJekoTransaction(tx);
    await settleJekoTransaction({ ...tx, status: 'pending' });
    expect(announce).not.toHaveBeenCalled();
  });

  it("n'annonce pas une commande déjà alertée (paiement tardif, rupture, montant)", async () => {
    findOrder.mockResolvedValue({ ...order, status: 'CANCELLED' } as never);
    await settleJekoTransaction(tx);

    findOrder.mockResolvedValue(order as never);
    pay
      .mockRejectedValueOnce(new StockShortageError('Stock insuffisant'))
      .mockResolvedValueOnce({ startedPreparation: false });
    await settleJekoTransaction(tx);

    await settleJekoTransaction({ ...tx, amountFcfa: 1 });

    expect(announce).not.toHaveBeenCalled();
  });

  it("n'échoue pas quand l'annonce échoue : le paiement est déjà enregistré", async () => {
    announce.mockRejectedValue(new Error('push indisponible'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(settleJekoTransaction(tx)).resolves.toBe('paid');
  });
});
