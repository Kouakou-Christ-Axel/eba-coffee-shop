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
  setOrderCustomer,
  setOrderLoyaltyReward,
  setOrderStatus,
  OrderMutationError,
} from '@/lib/order-mutations';
import {
  restoreLoyaltyForOrder,
  revokeLoyaltyForOrder,
} from '@/lib/loyalty-mutations';
import {
  mockOrderFindUnique,
  mockOrderUpdateMany,
  mockCustomerFindUnique,
  mockConsumeLoyaltyReward,
  orderWithOneItem,
} from './test-utils';

describe('setOrderCustomer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOrderUpdateMany.mockResolvedValue({ count: 1 } as never);
  });

  it('détache le client (customerId: null) en conditionnant sur le customerId lu', async () => {
    mockOrderFindUnique.mockResolvedValue({
      id: 'order1',
      customerId: 'cust-1',
      customerName: 'Awa',
      total: 2500,
    } as never);

    const result = await setOrderCustomer('order1', { customerId: null });

    expect(result).toEqual({ customerId: null });
    expect(mockOrderUpdateMany).toHaveBeenCalledWith({
      where: { id: 'order1', customerId: 'cust-1' },
      data: { customerId: null },
    });
  });

  it('refuse (409) le détachement si le client a changé entre-temps', async () => {
    mockOrderFindUnique.mockResolvedValue({
      id: 'order1',
      customerId: 'cust-1',
      customerName: 'Awa',
      total: 2500,
    } as never);
    mockOrderUpdateMany.mockResolvedValue({ count: 0 } as never);

    await expect(
      setOrderCustomer('order1', { customerId: null })
    ).rejects.toThrow(OrderMutationError);
  });

  it('rattache un client existant en conditionnant sur le customerId (anonyme) lu', async () => {
    mockOrderFindUnique.mockResolvedValue({
      id: 'order1',
      customerId: null,
      customerName: null,
      total: 2500,
    } as never);
    mockCustomerFindUnique.mockResolvedValue({
      id: 'cust-1',
      name: 'Awa',
      phone: '0708090910',
    } as never);

    const result = await setOrderCustomer('order1', { customerId: 'cust-1' });

    expect(result).toEqual({ customerId: 'cust-1' });
    expect(mockOrderUpdateMany).toHaveBeenCalledWith({
      where: { id: 'order1', customerId: null },
      data: {
        customerId: 'cust-1',
        customerName: 'Awa',
        customerPhone: '0708090910',
      },
    });
  });

  it('refuse (409) le rattachement si un autre caissier a déjà lié un client entre-temps', async () => {
    mockOrderFindUnique.mockResolvedValue({
      id: 'order1',
      customerId: null,
      customerName: null,
      total: 2500,
    } as never);
    mockCustomerFindUnique.mockResolvedValue({
      id: 'cust-1',
      name: 'Awa',
      phone: '0708090910',
    } as never);
    mockOrderUpdateMany.mockResolvedValue({ count: 0 } as never);

    await expect(
      setOrderCustomer('order1', { customerId: 'cust-1' })
    ).rejects.toThrow(OrderMutationError);
  });
});

describe('setOrderLoyaltyReward', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOrderUpdateMany.mockResolvedValue({ count: 1 } as never);
  });

  it('refuse (409) sur une commande annulée', async () => {
    mockOrderFindUnique.mockResolvedValue(
      orderWithOneItem({}, { status: 'CANCELLED' }) as never
    );

    await expect(
      setOrderLoyaltyReward('order1', { loyaltyRewardId: null })
    ).rejects.toThrow(OrderMutationError);
    expect(mockOrderUpdateMany).not.toHaveBeenCalled();
  });

  it('accepte une commande déjà TERMINÉE (rattrapage d’un palier posé trop tard)', async () => {
    mockOrderFindUnique.mockResolvedValue({
      id: 'order1',
      status: 'COMPLETED',
      customerId: 'cust-1',
      loyaltyRewardId: null,
      ...orderWithOneItem(),
    } as never);

    const result = await setOrderLoyaltyReward('order1', {
      loyaltyRewardId: null,
    });

    expect(result).toEqual({ total: 2500, loyaltyDiscount: null });
    expect(mockOrderUpdateMany).toHaveBeenCalledWith({
      where: { id: 'order1', status: { notIn: ['CANCELLED'] } },
      data: { total: 2500, loyaltyRewardId: null, loyaltyDiscount: null },
    });
  });

  it('retire la récompense (loyaltyRewardId: null) en conditionnant sur le statut', async () => {
    mockOrderFindUnique.mockResolvedValue({
      id: 'order1',
      status: 'NEW',
      customerId: 'cust-1',
      loyaltyRewardId: null,
      ...orderWithOneItem(),
    } as never);

    const result = await setOrderLoyaltyReward('order1', {
      loyaltyRewardId: null,
    });

    expect(result).toEqual({ total: 2500, loyaltyDiscount: null });
    expect(mockOrderUpdateMany).toHaveBeenCalledWith({
      where: { id: 'order1', status: { notIn: ['CANCELLED'] } },
      data: { total: 2500, loyaltyRewardId: null, loyaltyDiscount: null },
    });
    expect(mockConsumeLoyaltyReward).not.toHaveBeenCalled();
  });

  it('refuse (409) et ne consomme pas la récompense si la commande a changé de statut entre-temps', async () => {
    mockOrderFindUnique.mockResolvedValue({
      id: 'order1',
      status: 'NEW',
      customerId: 'cust-1',
      loyaltyRewardId: null,
      ...orderWithOneItem(),
    } as never);
    mockOrderUpdateMany.mockResolvedValue({ count: 0 } as never);

    await expect(
      setOrderLoyaltyReward('order1', { loyaltyRewardId: null })
    ).rejects.toThrow(OrderMutationError);
    expect(mockConsumeLoyaltyReward).not.toHaveBeenCalled();
  });
});

// ─── Commandes différées : le stock d'aujourd'hui n'est jamais touché ─────────

describe('setOrderStatus — fidélité à l’annulation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOrderUpdateMany.mockResolvedValue({ count: 1 });
  });

  it('annuler retire le tampon, en gardant la récompense appliquée sur la commande', async () => {
    mockOrderFindUnique.mockResolvedValue({
      status: 'NEW',
      dailyNumber: 3,
      customerId: 'cust-1',
      isPaid: false,
      total: 3500,
      loyaltyRewardId: 'r1',
    } as never);

    await setOrderStatus('o1', 'CANCELLED', 'ADMIN');

    expect(revokeLoyaltyForOrder).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        orderId: 'o1',
        customerId: 'cust-1',
        usedRewardId: 'r1',
        keepUsedReward: true,
      })
    );
    expect(restoreLoyaltyForOrder).not.toHaveBeenCalled();
  });

  it('rétablir une commande annulée lui rend son tampon', async () => {
    mockOrderFindUnique.mockResolvedValue({
      status: 'CANCELLED',
      dailyNumber: 3,
      customerId: 'cust-1',
      isPaid: false,
      total: 3500,
      loyaltyRewardId: null,
    } as never);

    await setOrderStatus('o1', 'NEW', 'ADMIN');

    expect(restoreLoyaltyForOrder).toHaveBeenCalledWith(expect.anything(), {
      orderId: 'o1',
      customerId: 'cust-1',
      orderTotal: 3500,
    });
    expect(revokeLoyaltyForOrder).not.toHaveBeenCalled();
  });

  it('ne touche pas à la fidélité si un autre caissier a déjà changé le statut', async () => {
    mockOrderFindUnique.mockResolvedValue({
      status: 'NEW',
      dailyNumber: 3,
      customerId: 'cust-1',
      isPaid: false,
      total: 3500,
      loyaltyRewardId: null,
    } as never);
    mockOrderUpdateMany.mockResolvedValue({ count: 0 });

    await expect(setOrderStatus('o1', 'CANCELLED', 'ADMIN')).rejects.toThrow(
      OrderMutationError
    );
    expect(revokeLoyaltyForOrder).not.toHaveBeenCalled();
  });
});
