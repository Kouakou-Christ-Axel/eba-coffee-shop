import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  default: { order: { update: vi.fn() } },
}));
vi.mock('@/lib/push-notify', () => ({
  sendPushToRoles: vi.fn().mockResolvedValue(undefined),
  notifyOrderCustomer: vi.fn(),
}));
vi.mock('@/lib/auth-helpers', () => ({
  ROLE_GROUPS: { CASHIER_PLUS: ['CASHIER'] },
}));
vi.mock('./config', () => ({ jekoConfig: vi.fn() }));
vi.mock('./transfers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./transfers')>()),
  createJekoContact: vi.fn(),
  createJekoTransfer: vi.fn(),
}));

import prisma from '@/lib/prisma';
import { notifyOrderCustomer, sendPushToRoles } from '@/lib/push-notify';
import { JekoApiError } from './client';
import { jekoConfig } from './config';
import { buildRefundReference, refundLatePayment } from './refund';
import { createJekoContact, createJekoTransfer } from './transfers';
import { tx } from './settle.test-utils';

const update = vi.mocked(prisma.order.update);
const contact = vi.mocked(createJekoContact);
const transfer = vi.mocked(createJekoTransfer);
const push = vi.mocked(sendPushToRoles);

const order = {
  id: 'o1',
  reference: 'EBA-20261003-AB12',
  dailyNumber: 12,
  customerName: 'Awa',
  customerPhone: '07 07 07 07 07',
  onlineFee: 35,
};

describe('refundLatePayment', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    push.mockResolvedValue(undefined as never);
    vi.mocked(jekoConfig).mockReturnValue({
      apiKey: 'k',
      apiKeyId: 'i',
      storeId: 's',
    });
    contact.mockResolvedValue({ id: 'c1' });
    transfer.mockResolvedValue({ id: 'wth_1', status: 'pending', feeFcfa: 12 });
  });

  it('rembourse les produits seuls (frais en ligne conservés) sur le numéro de la commande', async () => {
    await expect(
      refundLatePayment(order, tx, 'stock insuffisant')
    ).resolves.toBe('refunded');

    expect(contact).toHaveBeenCalledWith(expect.anything(), {
      name: 'Awa',
      method: 'wave',
      phoneE164: '+2250707070707',
    });
    expect(transfer).toHaveBeenCalledWith(expect.anything(), {
      contactId: 'c1',
      amountFcfa: 3450, // 3 485 payés − 35 de frais en ligne
      reference: buildRefundReference(order.reference, tx.transactionId),
      description: 'Remboursement commande EBA-20261003-AB12',
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: expect.objectContaining({
        paymentTransactionId: 'txn_1',
        refundTransferId: 'wth_1',
        refundAmount: 3450,
        refundFee: 12,
        refundedAt: expect.any(Date),
      }),
    });
    expect(notifyOrderCustomer).toHaveBeenCalledWith('o1', 'REFUNDED');
  });

  it('409 (livraison rejouée) : le transfert existe déjà, on n’en recrée pas un', async () => {
    transfer.mockRejectedValue(new JekoApiError(409, 'conflict', 'Existe'));

    await expect(
      refundLatePayment(order, tx, 'stock insuffisant')
    ).resolves.toBe('refunded');
    expect(transfer).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: expect.objectContaining({ refundTransferId: null, refundFee: 0 }),
    });
  });

  it.each([
    ['solde insuffisant', new JekoApiError(400, 'insufficient_balance', 'x')],
    [
      'panne réseau',
      new JekoApiError(503, 'network_error', 'Jèko injoignable'),
    ],
  ])(
    '%s : trace l’encaissement, alerte le staff, ne marque rien remboursé',
    async (_n, err) => {
      transfer.mockRejectedValue(err);
      vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(
        refundLatePayment(order, tx, 'stock insuffisant')
      ).resolves.toBe('manual');

      const data = update.mock.calls[0][0].data as Record<string, unknown>;
      expect(data.paymentTransactionId).toBe('txn_1');
      expect(data).not.toHaveProperty('refundedAt');
      expect(push).toHaveBeenCalledTimes(1);
      expect(notifyOrderCustomer).not.toHaveBeenCalled();
    }
  );

  it('numéro invalide, moyen inconnu ou montant sous le minimum : remboursement manuel sans appel Jèko', async () => {
    for (const [o, t] of [
      [{ ...order, customerPhone: 'abc' }, tx],
      [order, { ...tx, paymentMethod: 'bank' }],
      [order, { ...tx, paymentMethod: 'moov', amountFcfa: 90 }],
    ] as const) {
      await expect(refundLatePayment(o, t, 'stock insuffisant')).resolves.toBe(
        'manual'
      );
    }
    expect(contact).not.toHaveBeenCalled();
    expect(transfer).not.toHaveBeenCalled();
  });

  it('Jèko non configuré : remboursement manuel', async () => {
    vi.mocked(jekoConfig).mockReturnValue(null);
    await expect(
      refundLatePayment(order, tx, 'stock insuffisant')
    ).resolves.toBe('manual');
  });

  it('référence : déterministe et dans la plage 5 à 100 caractères', () => {
    const ref = buildRefundReference(
      order.reference,
      'txn_abcdefghijklmnopqrst'
    );
    expect(ref).toBe(
      buildRefundReference(order.reference, 'txn_abcdefghijklmnopqrst')
    );
    expect(ref.length).toBeGreaterThanOrEqual(5);
    expect(ref.length).toBeLessThanOrEqual(100);
  });
});
