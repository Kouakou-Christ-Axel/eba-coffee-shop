import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', async () =>
  (await import('@/lib/orders/mutations/test-mocks')).prismaModuleMock()
);

import prisma from '@/lib/prisma';
import { isHoldCandidate, summarizeStockHolds } from './state';

const p = prisma as unknown as Record<
  string,
  Record<string, ReturnType<typeof vi.fn>>
>;

const item = {
  cartId: 'c1',
  productId: 'gateau',
  productName: 'Gâteau',
  basePrice: 1000,
  coutMatiere: 0,
  coutEmballage: 0,
  quantity: 1,
  supplements: [
    { groupName: 'Goûts', optionName: 'Vanille', price: 0, quantity: 1 },
  ],
  discount: 0,
  discountReason: null,
};

describe('summarizeStockHolds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    p.supplementOption.findFirst.mockResolvedValue({ id: 'vanille' });
  });

  it('produit réservé, goût en attente : partiel, la ligne reste à produire', async () => {
    p.orderStockHold.findMany.mockResolvedValue([
      { orderId: 'o1', kind: 'PRODUCT', resourceId: 'gateau', quantity: 1 },
    ]);
    p.product.findMany.mockResolvedValue([{ id: 'gateau', stockQuantity: 0 }]);
    p.supplementOption.findMany.mockResolvedValue([
      { id: 'vanille', stockQuantity: 0 },
    ]);

    const res = (await summarizeStockHolds([{ id: 'o1', items: [item] }])).get(
      'o1'
    )!;

    expect(res.state).toBe('partial');
    expect(res.reserved).toBe(1);
    expect(res.total).toBe(2);
    expect(res.waiting).toEqual(['Gâteau (Vanille)']);
    expect(res.availability.fulfillable).toBe(false);
    expect(res.availability.items[0]).toMatchObject({
      missingProduct: false,
      missingOptionNames: ['Vanille'],
    });
  });

  it('tout réservé : prête à lancer et plus aucune rupture signalée', async () => {
    p.orderStockHold.findMany.mockResolvedValue([
      { orderId: 'o1', kind: 'PRODUCT', resourceId: 'gateau', quantity: 1 },
      { orderId: 'o1', kind: 'OPTION', resourceId: 'vanille', quantity: 1 },
    ]);
    p.product.findMany.mockResolvedValue([{ id: 'gateau', stockQuantity: 0 }]);
    p.supplementOption.findMany.mockResolvedValue([
      { id: 'vanille', stockQuantity: 0 },
    ]);

    const res = (await summarizeStockHolds([{ id: 'o1', items: [item] }])).get(
      'o1'
    )!;

    expect(res.state).toBe('full');
    expect(res.waiting).toEqual([]);
    expect(res.availability.fulfillable).toBe(true);
  });

  it('rien de réservé et rien en stock : en attente', async () => {
    p.orderStockHold.findMany.mockResolvedValue([]);
    p.product.findMany.mockResolvedValue([{ id: 'gateau', stockQuantity: 0 }]);
    p.supplementOption.findMany.mockResolvedValue([
      { id: 'vanille', stockQuantity: 0 },
    ]);

    const res = (await summarizeStockHolds([{ id: 'o1', items: [item] }])).get(
      'o1'
    )!;

    expect(res.state).toBe('none');
    expect(res.availability.fulfillable).toBe(false);
  });

  it('stock illimité : rien à réserver, la commande est prête', async () => {
    p.orderStockHold.findMany.mockResolvedValue([]);
    p.product.findMany.mockResolvedValue([
      { id: 'gateau', stockQuantity: null },
    ]);
    p.supplementOption.findMany.mockResolvedValue([
      { id: 'vanille', stockQuantity: null },
    ]);

    const res = (await summarizeStockHolds([{ id: 'o1', items: [item] }])).get(
      'o1'
    )!;

    expect(res.state).toBe('full');
    expect(res.total).toBe(0);
  });
});

describe('isHoldCandidate', () => {
  const now = new Date('2026-10-22T10:00:00Z');
  const base = {
    status: 'NEW',
    isPaid: true,
    stockReservedAt: null,
    pickupTime: new Date('2026-10-22T15:00:00Z'),
  };

  it('retient une payée non lancée dont le retrait est aujourd’hui', () => {
    expect(isHoldCandidate(base, now)).toBe(true);
  });

  it('écarte impayée, lancée, autre jour ou sans créneau', () => {
    expect(isHoldCandidate({ ...base, isPaid: false }, now)).toBe(false);
    expect(isHoldCandidate({ ...base, status: 'PREPARING' }, now)).toBe(false);
    expect(isHoldCandidate({ ...base, stockReservedAt: new Date() }, now)).toBe(
      false
    );
    expect(
      isHoldCandidate(
        { ...base, pickupTime: new Date('2026-10-23T15:00:00Z') },
        now
      )
    ).toBe(false);
    expect(isHoldCandidate({ ...base, pickupTime: null }, now)).toBe(false);
  });
});
