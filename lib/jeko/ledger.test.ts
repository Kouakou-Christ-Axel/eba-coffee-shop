import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  default: {
    order: { findMany: vi.fn() },
    refund: { aggregate: vi.fn() },
    jekoWithdrawal: { findMany: vi.fn() },
  },
}));

import prisma from '@/lib/prisma';
import { getJekoLedger } from './ledger';

const orders = vi.mocked(prisma.order.findMany);
const appRefunds = vi.mocked(prisma.refund.aggregate);

const paid = {
  total: 1000,
  onlineFee: 10,
  gatewayFee: 15,
  paymentAmountDue: 1010,
  refundAmount: null as number | null,
  refundFee: null as number | null,
  _count: { refunds: 0 },
};

describe('getJekoLedger — remboursements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.jekoWithdrawal.findMany).mockResolvedValue([]);
    appRefunds.mockResolvedValue({ _sum: { amount: 0, feeFcfa: 0 } } as never);
  });

  it('déduit les remboursements envoyés par transfert (montant + frais)', async () => {
    orders.mockResolvedValue([paid] as never);
    appRefunds.mockResolvedValue({
      _sum: { amount: 400, feeFcfa: 5 },
    } as never);

    const ledger = await getJekoLedger();
    expect(ledger.refunded).toBe(405);
    expect(ledger.netReceived).toBe(1010 - 15 - 405);
    expect(ledger.balance).toBe(590);
  });

  it('ancienne commande remboursée (colonnes seules, sans ligne Refund) : comptée comme avant', async () => {
    orders.mockResolvedValue([
      { ...paid, refundAmount: 1000, refundFee: 12 },
    ] as never);

    const ledger = await getJekoLedger();
    expect(ledger.refunded).toBe(1012);
  });

  it('commande qui porte aussi une ligne Refund : colonnes ignorées, pas de double compte', async () => {
    orders.mockResolvedValue([
      { ...paid, refundAmount: 1000, refundFee: 12, _count: { refunds: 1 } },
    ] as never);
    appRefunds.mockResolvedValue({
      _sum: { amount: 1000, feeFcfa: 12 },
    } as never);

    const ledger = await getJekoLedger();
    expect(ledger.refunded).toBe(1012);
  });

  it('ne lit que les commandes, remboursements et retraits du compte demandé', async () => {
    orders.mockResolvedValue([] as never);
    await getJekoLedger('B');

    expect(orders).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { paymentTransactionId: { not: null }, jekoAccount: 'B' },
      })
    );
    expect(appRefunds).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ order: { jekoAccount: 'B' } }),
      })
    );
    expect(prisma.jekoWithdrawal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { jekoAccount: 'B' } })
    );
  });

  it('ne compte que les transferts Jèko réellement partis ou en cours', async () => {
    orders.mockResolvedValue([paid] as never);
    await getJekoLedger();
    expect(appRefunds).toHaveBeenCalledWith({
      where: {
        delivery: 'JEKO_TRANSFER',
        order: { jekoAccount: 'A' },
        status: { in: ['PAID', 'PROCESSING', 'UNCERTAIN'] },
      },
      _sum: { amount: true, feeFcfa: true },
    });
  });
});
