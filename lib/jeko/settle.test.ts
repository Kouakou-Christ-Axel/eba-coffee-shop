// lib/jeko/settle.test.ts
//
// Règlement d'une transaction Jèko reçue par webhook (ou lue à la réconciliation).
// L'argent a déjà bougé chez Jèko : chaque cas limite doit finir par un état que
// le staff voit, jamais par un paiement perdu en silence.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Ces deux classes reproduisent FIDÈLEMENT celles de lib/order-mutations.ts
// (champ `httpStatus`, `StockShortageError(message)` toujours en 409) : une
// fausse classe aux champs inventés ferait passer le test alors que le vrai code
// ne marcherait pas.
const { OrderMutationError, StockShortageError } = vi.hoisted(() => {
  class OrderMutationError extends Error {
    constructor(
      message: string,
      readonly httpStatus: number
    ) {
      super(message);
    }
  }
  class StockShortageError extends OrderMutationError {
    constructor(message: string) {
      super(message, 409);
    }
  }
  return { OrderMutationError, StockShortageError };
});

vi.mock('@/lib/order-mutations', () => ({
  setOrderPayment: vi.fn(),
  OrderMutationError,
  StockShortageError,
}));
vi.mock('@/lib/prisma', () => ({
  default: { order: { findUnique: vi.fn(), update: vi.fn() } },
}));
vi.mock('@/lib/push-notify', () => ({ sendPushToRoles: vi.fn() }));
vi.mock('./notify-paid', () => ({ announcePaidOrder: vi.fn() }));
vi.mock('@/lib/auth-helpers', () => ({
  ROLE_GROUPS: { CASHIER_PLUS: ['CASHIER', 'MANAGER', 'ADMIN'] },
}));

import prisma from '@/lib/prisma';
import { setOrderPayment } from '@/lib/order-mutations';
import { sendPushToRoles } from '@/lib/push-notify';
import { announcePaidOrder } from './notify-paid';
import { settleJekoTransaction } from './settle';
import type { JekoTransaction } from './webhook-payload';

const findOrder = vi.mocked(prisma.order.findUnique);
const updateOrder = vi.mocked(prisma.order.update);
const pay = vi.mocked(setOrderPayment);
const push = vi.mocked(sendPushToRoles);
const announce = vi.mocked(announcePaidOrder);

const order = {
  id: 'o1',
  isPaid: false,
  status: 'NEW',
  total: 3450,
  onlineFee: 35,
  dailyNumber: 12,
  paymentAmountDue: 3485,
  paymentTransactionId: null as string | null,
};

const tx: JekoTransaction = {
  transactionId: 'txn_1',
  status: 'success',
  amountFcfa: 3485, // total 3 450 + frais 35
  gatewayFeeFcfa: 52.28,
  paymentMethod: 'wave',
  reference: 'EBA-20261003-AB12-1',
  paymentRequestId: 'pr_1',
};

describe('settleJekoTransaction', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    push.mockResolvedValue(undefined as never);
    announce.mockResolvedValue(undefined);
    findOrder.mockResolvedValue(order as never);
    updateOrder.mockResolvedValue({} as never);
    pay.mockResolvedValue({ startedPreparation: true });
  });

  it('encaisse le total des produits (sans les frais) et note les frais réels de Jèko', async () => {
    await expect(settleJekoTransaction(tx)).resolves.toBe('paid');

    expect(findOrder).toHaveBeenCalledWith(
      expect.objectContaining({ where: { reference: 'EBA-20261003-AB12' } })
    );
    expect(pay).toHaveBeenCalledWith(
      'o1',
      true,
      [{ mode: 'WAVE', amount: 3450 }],
      null
    );
    expect(updateOrder).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: {
        gatewayFee: 52,
        paymentRequestId: 'pr_1',
        paymentTransactionId: 'txn_1',
      },
    });
  });

  it('enregistre le moyen réellement utilisé', async () => {
    await settleJekoTransaction({ ...tx, paymentMethod: 'mtn' });
    expect(pay).toHaveBeenCalledWith(
      'o1',
      true,
      [{ mode: 'MTN_MONEY', amount: 3450 }],
      null
    );
  });

  it('ne fait rien si la commande est déjà payée (webhook livré deux fois)', async () => {
    findOrder.mockResolvedValue({ ...order, isPaid: true } as never);
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
      null
    );
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("sort la commande de l'attente et alerte le staff si le stock manque entre-temps", async () => {
    pay.mockRejectedValue(new StockShortageError('Stock insuffisant'));

    await expect(settleJekoTransaction(tx)).resolves.toBe('shortage');

    expect(updateOrder).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: { paymentExpiresAt: null },
    });
    expect(push).toHaveBeenCalledTimes(1);
  });

  it('traite comme déjà payée la course de deux livraisons simultanées', async () => {
    pay.mockRejectedValue(
      new OrderMutationError('État de paiement déjà à jour', 409)
    );
    findOrder
      .mockResolvedValueOnce(order as never)
      .mockResolvedValueOnce({ ...order, isPaid: true } as never);

    await expect(settleJekoTransaction(tx)).resolves.toBe('already_paid');
  });

  it('annonce au staff une commande normale qui vient d’être payée', async () => {
    await settleJekoTransaction(tx);
    expect(announce).toHaveBeenCalledWith('o1');
  });

  it("n'annonce pas deux fois quand le règlement ne fait rien (déjà payée, ignorée)", async () => {
    findOrder.mockResolvedValue({ ...order, isPaid: true } as never);
    await settleJekoTransaction(tx);
    await settleJekoTransaction({ ...tx, status: 'pending' });
    expect(announce).not.toHaveBeenCalled();
  });

  it("n'annonce pas une commande déjà alertée (paiement tardif, rupture, montant)", async () => {
    findOrder.mockResolvedValue({ ...order, status: 'CANCELLED' } as never);
    await settleJekoTransaction(tx);

    findOrder.mockResolvedValue(order as never);
    pay.mockRejectedValue(new StockShortageError('Stock insuffisant'));
    await settleJekoTransaction(tx);

    await settleJekoTransaction({ ...tx, amountFcfa: 1 });

    expect(announce).not.toHaveBeenCalled();
  });

  it("n'échoue pas quand l'annonce échoue : le paiement est déjà enregistré", async () => {
    announce.mockRejectedValue(new Error('push indisponible'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(settleJekoTransaction(tx)).resolves.toBe('paid');
  });

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
      null
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
      where: { id: 'o1' },
      data: { paymentExpiresAt: null },
    });
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

  it("complète frais et transaction si l'écriture qui suit le paiement avait échoué (livraison rejouée)", async () => {
    findOrder.mockResolvedValue({
      ...order,
      isPaid: true,
      paymentTransactionId: null,
    } as never);

    await expect(settleJekoTransaction(tx)).resolves.toBe('already_paid');

    expect(updateOrder).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: {
        gatewayFee: 52,
        paymentRequestId: 'pr_1',
        paymentTransactionId: 'txn_1',
      },
    });
    expect(push).not.toHaveBeenCalled();
  });

  it("annonce la commande AVANT l'écriture des frais : un échec de cette écriture ne la fait pas manquer", async () => {
    updateOrder.mockRejectedValue(new Error('base indisponible'));

    await expect(settleJekoTransaction(tx)).rejects.toThrow(
      'base indisponible'
    );

    expect(announce).toHaveBeenCalledWith('o1');
  });

  it('relance toute autre erreur pour que Jèko réessaie la livraison', async () => {
    pay.mockRejectedValue(new Error('connexion perdue'));
    await expect(settleJekoTransaction(tx)).rejects.toThrow('connexion perdue');
  });
});
