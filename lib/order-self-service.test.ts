// lib/order-self-service.test.ts
//
// Libre-service client : gardes d'éligibilité, périmètre des remplacements
// (lignes indisponibles seulement), prix serveur, remise fidélité recalculée,
// créneau validé contre ceux du sélecteur. Prisma et les dépendances métier
// sont mockés — leurs propres règles sont testées ailleurs.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const tx = {
  order: { updateMany: vi.fn() },
  loyaltyReward: { findUnique: vi.fn() },
};

vi.mock('@/lib/prisma', () => ({
  default: {
    order: { findUnique: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  },
}));
vi.mock('@/lib/order-mutations', () => {
  class OrderMutationError extends Error {
    constructor(
      message: string,
      readonly httpStatus: number
    ) {
      super(message);
    }
  }
  return { OrderMutationError, buildOrderItemsFromMenu: vi.fn() };
});
vi.mock('@/lib/orders', () => ({ assertPublicOrderConstraints: vi.fn() }));
vi.mock('@/lib/orders/availability', async () => ({
  fetchStockSnapshot: vi.fn(),
  computeOrderItemsAvailability: (
    await import('@/lib/orders/availability-core')
  ).computeOrderItemsAvailability,
}));
vi.mock('@/lib/menu', () => ({ getMenu: vi.fn() }));
vi.mock('@/lib/pickup-settings-db', () => ({
  getPickupSettings: vi.fn(),
  getAvailablePickupSlots: vi.fn(),
}));
vi.mock('@/lib/push-notify', () => ({
  sendPushToRoles: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/loyalty-mutations', () => ({ revokeLoyaltyForOrder: vi.fn() }));

import prisma from '@/lib/prisma';
import { buildOrderItemsFromMenu } from '@/lib/order-mutations';
import { assertPublicOrderConstraints } from '@/lib/orders';
import { fetchStockSnapshot } from '@/lib/orders/availability';
import { getMenu } from '@/lib/menu';
import {
  getAvailablePickupSlots,
  getPickupSettings,
} from '@/lib/pickup-settings-db';
import { sendPushToRoles } from '@/lib/push-notify';
import { revokeLoyaltyForOrder } from '@/lib/loyalty-mutations';
import {
  cancelOrderByCustomer,
  replaceUnavailableItems,
  rescheduleOrderByCustomer,
} from './order-self-service';

const findUnique = vi.mocked(prisma.order.findUnique);
const updateMany = vi.mocked(prisma.order.updateMany);

const line = (cartId: string, productId: string, basePrice = 1000) => ({
  cartId,
  productId,
  productName: productId,
  basePrice,
  coutMatiere: 0,
  coutEmballage: 0,
  quantity: 1,
  supplements: [],
});

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: 'o1',
    reference: 'EBA-20260925-AB12',
    dailyNumber: 7,
    source: 'ONLINE',
    status: 'NEW',
    isPaid: false,
    stockReservedAt: null,
    paymentProofUrl: null,
    depositPaid: 0,
    isOnAccount: false,
    items: [line('a', 'cookie', 1000), line('b', 'sponge', 2000)],
    pickupTime: null,
    customerId: 'c1',
    loyaltyRewardId: null,
    loyaltyDiscount: null,
    updatedAt: new Date('2026-09-25T10:00:00Z'),
    ...overrides,
  };
}

/** `sponge` épuisé, `cookie` et `brownie` en stock illimité. */
function stockWithSpongeSoldOut() {
  vi.mocked(fetchStockSnapshot).mockResolvedValue({
    products: new Map<string, number | null>([
      ['cookie', null],
      ['sponge', 0],
    ]),
    options: new Map(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  updateMany.mockResolvedValue({ count: 1 });
  tx.order.updateMany.mockResolvedValue({ count: 1 });
});

describe('cancelOrderByCustomer', () => {
  it('404 si la commande est introuvable', async () => {
    findUnique.mockResolvedValue(null);
    await expect(cancelOrderByCustomer('o1')).rejects.toMatchObject({
      httpStatus: 404,
    });
  });

  it('409 si la commande est déjà engagée (payée)', async () => {
    findUnique.mockResolvedValue(order({ isPaid: true }) as never);
    await expect(cancelOrderByCustomer('o1')).rejects.toMatchObject({
      httpStatus: 409,
    });
    expect(tx.order.updateMany).not.toHaveBeenCalled();
  });

  it('409 si la caisse l’a engagée entre la lecture et l’écriture', async () => {
    findUnique.mockResolvedValue(order() as never);
    tx.order.updateMany.mockResolvedValue({ count: 0 });
    await expect(cancelOrderByCustomer('o1')).rejects.toMatchObject({
      httpStatus: 409,
    });
    expect(revokeLoyaltyForOrder).not.toHaveBeenCalled();
  });

  it('annule sous garde, défait la fidélité et prévient le staff', async () => {
    findUnique.mockResolvedValue(order({ loyaltyRewardId: 'r1' }) as never);
    await cancelOrderByCustomer('o1');

    expect(tx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'o1',
          status: 'NEW',
          isPaid: false,
        }),
        data: expect.objectContaining({
          status: 'CANCELLED',
          loyaltyRewardId: null,
        }),
      })
    );
    expect(revokeLoyaltyForOrder).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        orderId: 'o1',
        customerId: 'c1',
        usedRewardId: 'r1',
      })
    );
    expect(sendPushToRoles).toHaveBeenCalled();
  });
});

describe('replaceUnavailableItems', () => {
  beforeEach(() => {
    stockWithSpongeSoldOut();
    vi.mocked(getMenu).mockResolvedValue([
      {
        id: 'cat',
        name: 'Cat',
        products: [
          { id: 'brownie', name: 'Brownie', description: '', price: 1500 },
          {
            id: 'perso',
            name: 'Gâteau perso',
            description: '',
            price: 9000,
            requiresDeposit: true,
          },
        ],
      },
    ]);
    // Le prix vient du menu serveur, jamais de la requête.
    vi.mocked(buildOrderItemsFromMenu).mockResolvedValue([
      { ...line('mcp-0', 'brownie', 1500), requiresDeposit: false },
    ] as never);
  });

  it('refuse de toucher une ligne encore disponible', async () => {
    findUnique.mockResolvedValue(order() as never);
    await expect(
      replaceUnavailableItems('o1', [{ cartId: 'a', action: 'remove' }])
    ).rejects.toMatchObject({ httpStatus: 409 });
  });

  it('refuse un remplaçant qui exige un acompte', async () => {
    findUnique.mockResolvedValue(order() as never);
    await expect(
      replaceUnavailableItems('o1', [
        {
          cartId: 'b',
          action: 'replace',
          with: { productId: 'perso', quantity: 1 },
        },
      ])
    ).rejects.toMatchObject({ httpStatus: 409 });
  });

  it('remplace à la même position, au prix serveur, et recalcule la remise', async () => {
    findUnique.mockResolvedValue(
      order({ loyaltyRewardId: 'r1', loyaltyDiscount: 2000 }) as never
    );
    tx.loyaltyReward.findUnique.mockResolvedValue({ capAmount: 5000 });

    await replaceUnavailableItems('o1', [
      {
        cartId: 'b',
        action: 'replace',
        with: { productId: 'brownie', quantity: 1 },
      },
    ]);

    const { data, where } = tx.order.updateMany.mock.calls[0][0];
    expect(data.items.map((i: { productId: string }) => i.productId)).toEqual([
      'cookie',
      'brownie',
    ]);
    // Brut 1000 + 1500 = 2500 ; remise plafonnée au brut (cap 5000).
    expect(data.loyaltyDiscount).toBe(2500);
    expect(data.total).toBe(0);
    expect(where.updatedAt).toEqual(new Date('2026-09-25T10:00:00Z'));
    expect(assertPublicOrderConstraints).toHaveBeenCalled();
  });

  it('refuse de vider la commande (il faut l’annuler)', async () => {
    findUnique.mockResolvedValue(
      order({ items: [line('b', 'sponge')] }) as never
    );
    await expect(
      replaceUnavailableItems('o1', [{ cartId: 'b', action: 'remove' }])
    ).rejects.toMatchObject({ httpStatus: 400 });
  });
});

describe('rescheduleOrderByCustomer', () => {
  const slot = new Date('2026-09-26T09:00:00.000Z');

  beforeEach(() => {
    findUnique.mockResolvedValue(order() as never);
    vi.mocked(getPickupSettings).mockResolvedValue({ visibleDays: 7 } as never);
  });

  it('refuse un créneau que le sélecteur ne propose pas', async () => {
    vi.mocked(getAvailablePickupSlots).mockResolvedValue([]);
    await expect(
      rescheduleOrderByCustomer('o1', slot.toISOString())
    ).rejects.toMatchObject({ httpStatus: 409 });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('enregistre un créneau proposé, après les règles de commande', async () => {
    vi.mocked(getAvailablePickupSlots).mockResolvedValue([slot]);
    await rescheduleOrderByCustomer('o1', slot.toISOString());
    expect(assertPublicOrderConstraints).toHaveBeenCalledWith(
      expect.any(Array),
      slot
    );
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { pickupTime: slot } })
    );
  });

  it('accepte « dès que possible » sans consulter les créneaux', async () => {
    await rescheduleOrderByCustomer('o1', null);
    expect(getAvailablePickupSlots).not.toHaveBeenCalled();
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { pickupTime: null } })
    );
  });
});
