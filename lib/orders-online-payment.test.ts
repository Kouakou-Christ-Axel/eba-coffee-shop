// lib/orders-online-payment.test.ts
//
// `createOrder` avec paiement en ligne (Jèko). Le paramètre `onlinePayment` est
// optionnel : SANS lui, la commande reste exactement celle d'avant (pas de
// vérification du panier, pas de frais, notification staff immédiate). AVEC lui :
//   - le panier est vérifié contre le menu AVANT toute écriture ;
//   - les frais se calculent sur le total NET (après récompense fidélité) et sont
//     posés dans la MÊME transaction que la création, avec l'échéance de paiement ;
//   - la commande n'est pas annoncée au staff : elle est invisible tant qu'elle
//     n'est pas payée, la notification part au règlement (lib/jeko/settle.ts).

import { beforeEach, describe, expect, it, vi } from 'vitest';

const tx = vi.hoisted(() => ({
  order: { create: vi.fn(), update: vi.fn() },
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    $transaction: vi.fn(async (cb: (t: unknown) => unknown) => cb(tx)),
  },
}));
vi.mock('@/lib/daily-numbering', () => ({
  getNextDailyNumber: vi.fn().mockResolvedValue(7),
  todayDailyDate: () => new Date('2026-10-03T00:00:00.000Z'),
}));
vi.mock('@/lib/customer-mutations', () => ({
  upsertCustomerForOrder: vi.fn().mockResolvedValue('cust-1'),
}));
vi.mock('@/lib/loyalty-mutations', () => ({
  awardLoyaltyForOrder: vi.fn().mockResolvedValue({ rewards: [] }),
  consumeLoyaltyReward: vi.fn().mockResolvedValue(undefined),
  resolveLoyaltyReward: vi.fn(),
}));
vi.mock('@/lib/loyalty', () => ({
  getLoyaltyCard: vi.fn(),
  getLoyaltyCardByPhone: vi.fn(),
}));
vi.mock('@/lib/push-notify', () => ({ sendPushToRoles: vi.fn() }));
vi.mock('@/lib/auth-helpers', () => ({
  ROLE_GROUPS: { DASHBOARD: ['ADMIN'] },
}));
vi.mock('@/lib/orders/availability', () => ({
  fetchStockSnapshot: vi.fn(),
  computeOrderItemsAvailability: vi.fn(),
  buildSoldOutLines: vi.fn(),
  fetchAdvanceOrderSnapshot: vi.fn().mockResolvedValue({}),
  maxRequiredAdvanceOrderDays: vi.fn().mockReturnValue(0),
  fetchScheduleSnapshot: vi.fn().mockResolvedValue({}),
  findScheduleBlockedItem: vi.fn().mockReturnValue(null),
}));
// Retrait différé : le contrôle de stock du jour est sans objet ici.
vi.mock('@/lib/orders/scheduling', () => ({
  isDeferredPickup: vi.fn().mockReturnValue(true),
}));

import { resolveLoyaltyReward } from '@/lib/loyalty-mutations';
import { sendPushToRoles } from '@/lib/push-notify';
import { CartMismatchError } from '@/lib/orders/cart-verification';
import { createOrder } from './orders';

const menu = [
  {
    products: [{ id: 'p1', price: 3500, supplements: [] }],
  },
] as never;

const input = {
  customerName: 'Kofi Yao',
  customerPhone: '+2250701020304',
  items: [
    {
      cartId: 'c1',
      productId: 'p1',
      productName: 'Gâteau',
      basePrice: 3500,
      quantity: 1,
      supplements: [],
      discount: 0,
    },
  ],
  total: 3500,
} as never;

const expiresAt = new Date('2026-10-03T12:15:00.000Z');
const online = { feePercent: 1, expiresAt, menu };

function createdOrder(total: number) {
  return {
    id: 'o1',
    reference: 'EBA-20261003-AB12',
    dailyNumber: 7,
    customerName: 'Kofi Yao',
    orderType: 'TAKEAWAY',
    total,
  };
}

describe('createOrder avec paiement en ligne', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(sendPushToRoles).mockResolvedValue(undefined as never);
    tx.order.create.mockResolvedValue(createdOrder(3500));
    tx.order.update.mockImplementation(async ({ data }) => ({
      ...createdOrder(3500),
      ...data,
    }));
  });

  it('pose les frais (1 % du total) et l’échéance dans la transaction de création', async () => {
    const order = await createOrder(input, { onlinePayment: online });

    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: { onlineFee: 35, paymentExpiresAt: expiresAt },
    });
    expect(order).toMatchObject({ onlineFee: 35, paymentExpiresAt: expiresAt });
  });

  it('calcule les frais sur le total NET, après la récompense fidélité', async () => {
    vi.mocked(resolveLoyaltyReward).mockResolvedValue({
      id: 'r1',
      capAmount: 500,
    });
    tx.order.create.mockResolvedValue(createdOrder(3000));
    tx.order.update.mockImplementation(async ({ data }) => ({
      ...createdOrder(3000),
      ...data,
    }));

    await createOrder(
      { ...(input as object), loyaltyRewardId: 'r1' } as never,
      { onlinePayment: online }
    );

    expect(tx.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ total: 3000 }),
      })
    );
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: { onlineFee: 30, paymentExpiresAt: expiresAt },
    });
  });

  it('refuse un total falsifié AVANT toute écriture', async () => {
    await expect(
      createOrder({ ...(input as object), total: 1 } as never, {
        onlinePayment: online,
      })
    ).rejects.toBeInstanceOf(CartMismatchError);

    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it('ne demande aucun paiement quand la récompense couvre toute la commande', async () => {
    vi.mocked(resolveLoyaltyReward).mockResolvedValue({
      id: 'r1',
      capAmount: 5000,
    });
    tx.order.create.mockResolvedValue(createdOrder(0));

    await createOrder(
      { ...(input as object), loyaltyRewardId: 'r1' } as never,
      { onlinePayment: online }
    );

    expect(tx.order.update).not.toHaveBeenCalled();
  });

  it("n'annonce pas au staff une commande qui n'est pas encore payée", async () => {
    await createOrder(input, { onlinePayment: online });
    expect(sendPushToRoles).not.toHaveBeenCalled();
  });
});

describe('createOrder sans paiement en ligne', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(sendPushToRoles).mockResolvedValue(undefined as never);
    tx.order.create.mockResolvedValue(createdOrder(3500));
  });

  it('reste inchangé : aucun frais, aucune échéance, staff prévenu aussitôt', async () => {
    await createOrder(input);

    expect(tx.order.update).not.toHaveBeenCalled();
    expect(sendPushToRoles).toHaveBeenCalledTimes(1);
  });

  it('ne vérifie pas le panier (comportement historique)', async () => {
    await expect(
      createOrder({ ...(input as object), total: 1 } as never)
    ).resolves.toBeDefined();
  });
});
