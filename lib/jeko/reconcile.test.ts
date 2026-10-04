// lib/jeko/reconcile.test.ts
//
// Réconciliation à la demande (client de retour sur la page de suivi) : on lit la
// demande chez Jèko et, si elle a réussi, on règle la commande SANS attendre le
// webhook (Jèko peut mettre jusqu'à 5 min à réconcilier). Le webhook reste la
// source de vérité ; ceci n'en est que le filet, et `settle` est idempotent.

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  default: { order: { findUnique: vi.fn() } },
}));
vi.mock('./client', () => ({ getJekoPaymentRequest: vi.fn() }));
vi.mock('./settle', () => ({ settleJekoTransaction: vi.fn() }));

import prisma from '@/lib/prisma';
import { getJekoPaymentRequest } from './client';
import { settleJekoTransaction } from './settle';
import { PaymentNotPendingError } from './start-payment';
import { reconcileOrderPayment, settleFromRemote } from './reconcile';

const findOrder = vi.mocked(prisma.order.findUnique);
const getRequest = vi.mocked(getJekoPaymentRequest);
const settle = vi.mocked(settleJekoTransaction);

const config = { apiKey: 'k', apiKeyId: 'i', storeId: 's' };

const success = {
  id: 'pr_1',
  status: 'success',
  reference: 'EBA-20261003-AB12-1',
  paymentMethod: 'wave',
  errorReason: null,
  transactionId: 'txn_1',
  amountFcfa: 3485,
  gatewayFeeFcfa: 52.28,
} as const;

describe('settleFromRemote', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    settle.mockResolvedValue('paid');
  });

  it('règle un paiement réussi à partir de la lecture Jèko', async () => {
    await expect(settleFromRemote(success)).resolves.toBe('paid');
    expect(settle).toHaveBeenCalledWith({
      transactionId: 'txn_1',
      status: 'success',
      amountFcfa: 3485,
      gatewayFeeFcfa: 52.28,
      paymentMethod: 'wave',
      reference: 'EBA-20261003-AB12-1',
      paymentRequestId: 'pr_1',
    });
  });

  it("renvoie « unreadable » sans rien régler quand la transaction n'est pas détaillée", async () => {
    await expect(
      settleFromRemote({ ...success, reference: null, amountFcfa: null })
    ).resolves.toBe('unreadable');
    expect(settle).not.toHaveBeenCalled();
  });

  it("utilise l'identifiant de la demande quand la transaction n'en a pas", async () => {
    await settleFromRemote({ ...success, transactionId: null });
    expect(settle).toHaveBeenCalledWith(
      expect.objectContaining({ transactionId: 'pr_1' })
    );
  });
});

describe('reconcileOrderPayment', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    findOrder.mockResolvedValue({
      isPaid: false,
      paymentRequestId: 'pr_1',
    } as never);
    getRequest.mockResolvedValue(success as never);
    settle.mockResolvedValue('paid');
  });

  it('règle la commande quand Jèko confirme le paiement', async () => {
    await expect(reconcileOrderPayment('o1', config)).resolves.toEqual({
      status: 'success',
      errorReason: null,
    });
    expect(getRequest).toHaveBeenCalledWith(config, 'pr_1');
    expect(settle).toHaveBeenCalledTimes(1);
  });

  it('ne rappelle pas Jèko pour une commande déjà payée', async () => {
    findOrder.mockResolvedValue({
      isPaid: true,
      paymentRequestId: 'pr_1',
    } as never);

    await expect(reconcileOrderPayment('o1', config)).resolves.toMatchObject({
      status: 'success',
    });
    expect(getRequest).not.toHaveBeenCalled();
  });

  it("n'exécute rien tant que le paiement est en cours", async () => {
    getRequest.mockResolvedValue({ id: 'pr_1', status: 'pending' } as never);

    await expect(reconcileOrderPayment('o1', config)).resolves.toEqual({
      status: 'pending',
      errorReason: null,
    });
    expect(settle).not.toHaveBeenCalled();
  });

  it("transmet la raison de l'échec sans toucher à la commande", async () => {
    getRequest.mockResolvedValue({
      id: 'pr_1',
      status: 'error',
      errorReason: 'insufficient_balance',
    } as never);

    await expect(reconcileOrderPayment('o1', config)).resolves.toEqual({
      status: 'error',
      errorReason: 'insufficient_balance',
    });
    expect(settle).not.toHaveBeenCalled();
  });

  it('refuse une commande introuvable ou sans demande de paiement', async () => {
    findOrder.mockResolvedValue(null as never);
    await expect(reconcileOrderPayment('o1', config)).rejects.toMatchObject({
      reason: 'not_found',
    });

    findOrder.mockResolvedValue({
      isPaid: false,
      paymentRequestId: null,
    } as never);
    await expect(reconcileOrderPayment('o1', config)).rejects.toBeInstanceOf(
      PaymentNotPendingError
    );
  });

  it('laisse remonter une panne de Jèko : le client réessaiera', async () => {
    getRequest.mockRejectedValue(new Error('Jèko indisponible'));
    await expect(reconcileOrderPayment('o1', config)).rejects.toThrow(
      'Jèko indisponible'
    );
  });
});
