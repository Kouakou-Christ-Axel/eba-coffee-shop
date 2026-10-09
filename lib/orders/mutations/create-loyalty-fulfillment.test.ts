import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', async () =>
  (await import('./test-mocks')).prismaModuleMock()
);
vi.mock('@/lib/push-notify', async () =>
  (await import('./test-mocks')).pushNotifyModuleMock()
);
vi.mock('@/lib/customer-mutations', async () =>
  (await import('./test-mocks')).customerMutationsModuleMock()
);
vi.mock('@/lib/loyalty-mutations', async () =>
  (await import('./test-mocks')).loyaltyMutationsModuleMock()
);

import {
  createCashierOrder,
  updateOrderFulfillment,
  OrderMutationError,
} from '@/lib/order-mutations';
import type { CartItem } from '@/lib/cart-store';
import {
  mockOrderFindUnique,
  mockOrderUpdateMany,
  mockOrderUpdate,
  mockOrderCreate,
  mockCustomerFindUnique,
  mockUpsertCustomer,
  mockConsumeLoyaltyReward,
  mockAwardLoyaltyForOrder,
  mockResolveLoyaltyReward,
  orderWithOneItem,
} from './test-utils';

describe('createCashierOrder — récompense fidélité auto-appliquée', () => {
  const items = orderWithOneItem().items as unknown as CartItem[];

  beforeEach(() => {
    vi.clearAllMocks();
    mockUpsertCustomer.mockResolvedValue('cust-1');
    mockCustomerFindUnique.mockResolvedValue({ isTrusted: false } as never);
    mockOrderCreate.mockImplementation((async (args: {
      data: Record<string, unknown>;
    }) => ({
      id: 'order-new',
      dailyNumber: 5,
      reference: 'EBA-20260804-B7C1',
      total: 2500,
      customerName: 'Awa',
      items,
      status: (args.data.status as string) ?? 'NEW',
    })) as never);
  });

  it('la commande qui débloque un palier (5e/10e tampon) applique directement sa propre réduction', async () => {
    mockAwardLoyaltyForOrder.mockResolvedValueOnce({
      rewards: [{ id: 'reward-10', tier: 10, capAmount: 2000 }],
    });
    mockOrderUpdate.mockResolvedValueOnce({
      id: 'order-new',
      total: 500,
      loyaltyRewardId: 'reward-10',
      loyaltyDiscount: 2000,
    } as never);

    const result = await createCashierOrder({
      items,
      customerName: 'Awa',
      customerPhone: '0708090910',
      orderType: 'DELIVERY',
    });

    expect(mockConsumeLoyaltyReward).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        rewardId: 'reward-10',
        orderId: 'order-new',
        capAmount: 2000,
      })
    );
    expect(mockOrderUpdate).toHaveBeenCalledWith({
      where: { id: 'order-new' },
      data: {
        total: 500,
        loyaltyRewardId: 'reward-10',
        loyaltyDiscount: 2000,
        depositRequired: null,
      },
    });
    expect((result as { total: number }).total).toBe(500);
    expect((result as { loyaltyRewardId: string }).loyaltyRewardId).toBe(
      'reward-10'
    );
  });

  it('ne cumule pas : une récompense déjà choisie pour cette commande n’est pas remplacée par celle que la commande vient elle-même de débloquer', async () => {
    mockResolveLoyaltyReward.mockResolvedValueOnce({
      id: 'reward-existing',
      capAmount: 1000,
    });
    mockAwardLoyaltyForOrder.mockResolvedValueOnce({
      rewards: [{ id: 'reward-10', tier: 10, capAmount: 2000 }],
    });

    await createCashierOrder({
      items,
      customerName: 'Awa',
      customerPhone: '0708090910',
      orderType: 'DELIVERY',
      loyaltyRewardId: 'reward-existing',
    });

    // Consommée une seule fois : la récompense pré-existante. La nouvelle
    // (débloquée par cette même commande) reste `AVAILABLE` pour la suivante.
    expect(mockConsumeLoyaltyReward).toHaveBeenCalledTimes(1);
    expect(mockConsumeLoyaltyReward).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ rewardId: 'reward-existing' })
    );
    expect(mockOrderUpdate).not.toHaveBeenCalled();
  });
});

describe('updateOrderFulfillment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOrderUpdateMany.mockResolvedValue({ count: 1 } as never);
  });

  it('refuse (409) sur une commande terminée', async () => {
    mockOrderFindUnique.mockResolvedValue({ status: 'COMPLETED' } as never);

    await expect(
      updateOrderFulfillment('order1', { orderType: 'DELIVERY' })
    ).rejects.toThrow(OrderMutationError);
    expect(mockOrderUpdateMany).not.toHaveBeenCalled();
  });

  it('refuse (409) sur une commande annulée', async () => {
    mockOrderFindUnique.mockResolvedValue({ status: 'CANCELLED' } as never);

    await expect(
      updateOrderFulfillment('order1', { orderType: 'DELIVERY' })
    ).rejects.toThrow(OrderMutationError);
  });

  it('lève (404) si la commande est introuvable', async () => {
    mockOrderFindUnique.mockResolvedValue(null);

    await expect(
      updateOrderFulfillment('order1', { orderType: 'DELIVERY' })
    ).rejects.toThrow(OrderMutationError);
  });

  it('refuse (409) si la commande est passée COMPLETED/CANCELLED entre la lecture et l’écriture', async () => {
    // La lecture initiale voit encore NEW (une autre requête a terminé/annulé
    // la commande juste après) : l'`updateMany` conditionnel ne trouve plus
    // de ligne correspondante et renvoie count: 0.
    mockOrderFindUnique.mockResolvedValue({ status: 'NEW' } as never);
    mockOrderUpdateMany.mockResolvedValue({ count: 0 } as never);

    await expect(
      updateOrderFulfillment('order1', { orderType: 'DELIVERY' })
    ).rejects.toThrow(OrderMutationError);
  });

  it('met à jour orderType/pickupTime/note directement, sans toucher au livreur si absent', async () => {
    mockOrderFindUnique.mockResolvedValue({ status: 'NEW' } as never);

    await updateOrderFulfillment('order1', {
      orderType: 'DELIVERY',
      pickupTime: '2026-08-01T10:00:00.000Z',
      note: 'Sonner deux fois',
    });

    expect(mockOrderUpdateMany).toHaveBeenCalledWith({
      where: { id: 'order1', status: { notIn: ['COMPLETED', 'CANCELLED'] } },
      data: {
        orderType: 'DELIVERY',
        pickupTime: new Date('2026-08-01T10:00:00.000Z'),
        note: 'Sonner deux fois',
      },
    });
  });

  it('délègue driverName/driverPhone à setOrderDriver sans dupliquer la normalisation', async () => {
    // Deux findUnique : un pour la garde de `updateOrderFulfillment`, un pour
    // celle de `setOrderDriver` (délégation, pas de logique dupliquée).
    mockOrderFindUnique.mockResolvedValue({ status: 'NEW' } as never);

    await updateOrderFulfillment('order1', {
      driverName: 'Ibrahim',
      driverPhone: '0708090910',
    });

    expect(mockOrderUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ driverName: 'Ibrahim' }),
      })
    );
  });

  it('nom du livreur seul : préserve le téléphone existant (jamais obligatoire)', async () => {
    mockOrderFindUnique.mockResolvedValue({
      status: 'NEW',
      driverName: null,
      driverPhone: null,
    } as never);

    await updateOrderFulfillment('order1', { driverName: 'Ibrahim' });

    expect(mockOrderUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          driverName: 'Ibrahim',
          driverPhone: null,
        }),
      })
    );
  });

  it('refuse (409) si le livreur est modifié entre-temps (délégation setOrderDriver)', async () => {
    mockOrderFindUnique.mockResolvedValue({ status: 'NEW' } as never);
    mockOrderUpdateMany.mockResolvedValue({ count: 0 } as never);

    await expect(
      updateOrderFulfillment('order1', { driverName: 'Ibrahim' })
    ).rejects.toThrow(OrderMutationError);
  });
});
