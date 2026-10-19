import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/order-mutations', async () =>
  (await import('./settle.test-errors')).orderMutationsModuleMock()
);
vi.mock('@/lib/prisma', () => ({
  default: { order: { findUnique: vi.fn(), updateMany: vi.fn() } },
}));
vi.mock('@/lib/push-notify', () => ({ sendPushToRoles: vi.fn() }));
vi.mock('./notify-paid', () => ({ announcePaidOrder: vi.fn() }));
vi.mock('./refund', () => ({ refundLatePayment: vi.fn() }));
vi.mock('@/lib/auth-helpers', () => ({
  ROLE_GROUPS: { CASHIER_PLUS: ['CASHIER', 'MANAGER', 'ADMIN'] },
}));

import { settleJekoTransaction } from './settle';
import { refundLatePayment } from './refund';
import {
  findOrder,
  updateOrder,
  pay,
  shortage,
  announce,
  order,
  tx,
  online,
  setupSettleMocks,
} from './settle.test-utils';
import { StockShortageError } from './settle.test-errors';

const refund = vi.mocked(refundLatePayment);

// Annulée par l'expiration : `paymentExpiresAt` reste renseigné.
const expired = {
  ...order,
  status: 'CANCELLED',
  paymentExpiresAt: new Date('2026-10-03T10:00:00Z'),
  reference: 'EBA-20261003-AB12',
  customerName: 'Awa',
  customerPhone: '+2250707070707',
  loyaltyRewardId: null,
  pickupTime: null,
};

const missing = [
  { name: 'Chou', needed: 2, available: 0 },
] as unknown as Awaited<ReturnType<typeof shortage>>;

describe('paiement Jèko après expiration de la commande', () => {
  beforeEach(() => {
    setupSettleMocks();
    findOrder.mockResolvedValue(expired as never);
    refund.mockResolvedValue('refunded');
  });

  it('stock suffisant : rétablit la commande, la valide et l’annonce — sans rembourser', async () => {
    await expect(settleJekoTransaction(tx)).resolves.toBe('late_validated');

    expect(updateOrder).toHaveBeenCalledWith({
      where: { id: 'o1', isPaid: false, status: 'CANCELLED' },
      data: { status: 'NEW' },
    });
    expect(pay).toHaveBeenCalledWith(
      'o1',
      true,
      [{ mode: 'WAVE', amount: 3450 }],
      null,
      { online }
    );
    expect(announce).toHaveBeenCalledWith('o1');
    expect(refund).not.toHaveBeenCalled();
  });

  it('stock insuffisant : rembourse tout de suite, sans toucher à la commande', async () => {
    shortage.mockResolvedValue(missing);

    await expect(settleJekoTransaction(tx)).resolves.toBe('late_refunded');

    expect(refund).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'o1', customerPhone: '+2250707070707' }),
      tx,
      'stock insuffisant'
    );
    expect(updateOrder).not.toHaveBeenCalled();
    expect(pay).not.toHaveBeenCalled();
  });

  it('remboursement impossible : signale l’échec (le staff a été alerté)', async () => {
    shortage.mockResolvedValue(missing);
    refund.mockResolvedValue('manual');

    await expect(settleJekoTransaction(tx)).resolves.toBe('late_refund_failed');
  });

  it('commande différée : le stock du jour ne compte pas, elle est validée', async () => {
    shortage.mockResolvedValue(missing);
    findOrder.mockResolvedValue({
      ...expired,
      pickupTime: new Date(Date.now() + 3 * 24 * 3600_000),
    } as never);

    await expect(settleJekoTransaction(tx)).resolves.toBe('late_validated');
    expect(refund).not.toHaveBeenCalled();
  });

  it('récompense fidélité déjà restituée : rembourse au lieu de la reconsommer', async () => {
    findOrder.mockResolvedValue({ ...expired, loyaltyRewardId: 'r1' } as never);

    await expect(settleJekoTransaction(tx)).resolves.toBe('late_refunded');
    expect(refund).toHaveBeenCalledWith(
      expect.anything(),
      tx,
      'récompense fidélité déjà restituée'
    );
    expect(shortage).not.toHaveBeenCalled();
    expect(pay).not.toHaveBeenCalled();
  });

  it('rupture survenue pendant la validation : remet la commande annulée puis rembourse', async () => {
    pay.mockRejectedValueOnce(new StockShortageError('Stock insuffisant'));

    await expect(settleJekoTransaction(tx)).resolves.toBe('late_refunded');

    expect(updateOrder).toHaveBeenLastCalledWith({
      where: { id: 'o1', isPaid: false, status: 'NEW' },
      data: { status: 'CANCELLED' },
    });
    expect(refund).toHaveBeenCalledWith(
      expect.anything(),
      tx,
      'stock insuffisant'
    );
  });

  it('commande modifiée entre la lecture et le rétablissement : Jèko réessaiera', async () => {
    updateOrder.mockResolvedValue({ count: 0 } as never);

    await expect(settleJekoTransaction(tx)).rejects.toThrow(
      'Commande modifiée'
    );
    expect(pay).not.toHaveBeenCalled();
    expect(refund).not.toHaveBeenCalled();
  });

  it('déjà remboursée par CETTE transaction : livraison rejouée, rien à refaire', async () => {
    findOrder.mockResolvedValue({
      ...expired,
      paymentTransactionId: 'txn_1',
    } as never);

    await expect(settleJekoTransaction(tx)).resolves.toBe('ignored');
    expect(refund).not.toHaveBeenCalled();
  });
});
