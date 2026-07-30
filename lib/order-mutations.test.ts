// lib/order-mutations.test.ts
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  type MockedFunction,
} from 'vitest';

vi.mock('@/lib/prisma', () => {
  const client = {
    order: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    orderPayment: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    product: {
      updateMany: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    supplementOption: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    // Les transactions reçoivent le même client mocké : les assertions sur les
    // mocks de premier niveau couvrent donc aussi les opérations transactionnelles.
    // `$transaction([...])` (forme tableau, utilisée pour le dépaiement) résout
    // simplement chaque promesse déjà construite avec ce même client mocké.
    $transaction: vi.fn(
      async (arg: ((tx: unknown) => Promise<unknown>) | Promise<unknown>[]) =>
        Array.isArray(arg) ? Promise.all(arg) : arg(client)
    ),
  };
  return { default: client };
});

vi.mock('@/lib/push-notify', () => ({
  notifyOrderCustomer: vi.fn(),
  sendPushToRoles: vi.fn(),
}));

import prisma from '@/lib/prisma';
import {
  setOrderPayment,
  payAndComplete,
  updateOrderFulfillment,
  OrderMutationError,
  StockShortageError,
} from './order-mutations';
import type { CartItem } from '@/lib/cart-store';

const mockOrderFindUnique = prisma.order.findUnique as MockedFunction<
  typeof prisma.order.findUnique
>;
const mockOrderUpdateMany = prisma.order.updateMany as MockedFunction<
  typeof prisma.order.updateMany
>;
const mockOrderUpdate = prisma.order.update as MockedFunction<
  typeof prisma.order.update
>;
const mockOrderPaymentCreateMany = prisma.orderPayment
  .createMany as MockedFunction<typeof prisma.orderPayment.createMany>;
const mockOrderPaymentDeleteMany = prisma.orderPayment
  .deleteMany as MockedFunction<typeof prisma.orderPayment.deleteMany>;
const mockProdUpdateMany = prisma.product.updateMany as MockedFunction<
  typeof prisma.product.updateMany
>;
const mockOptionFindFirst = prisma.supplementOption.findFirst as MockedFunction<
  typeof prisma.supplementOption.findFirst
>;
const mockOptionUpdateMany = prisma.supplementOption
  .updateMany as MockedFunction<typeof prisma.supplementOption.updateMany>;

const orderWithOneItem = (
  item: Partial<CartItem> = {},
  orderOverrides: { status?: string; total?: number } = {}
) => ({
  isPaid: false,
  status: 'NEW',
  total: 2500,
  ...orderOverrides,
  items: [
    {
      cartId: 'c1',
      productId: 'p1',
      productName: 'Tartelettes x3',
      basePrice: 2500,
      coutMatiere: 0,
      coutEmballage: 0,
      quantity: 1,
      supplements: [
        {
          groupName: 'Choisissez vos goûts',
          optionName: 'Cacahuète vanille',
          price: 0,
          quantity: 3,
        },
      ],
      discount: 0,
      discountReason: null,
      ...item,
    },
  ],
});

describe('setOrderPayment — décrément du stock au paiement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOrderUpdateMany.mockResolvedValue({ count: 1 } as never);
  });

  it('résout l’option par nom en ne considérant QUE les options disponibles (évite le doublon désactivé)', async () => {
    mockOrderFindUnique.mockResolvedValue(orderWithOneItem() as never);
    mockProdUpdateMany.mockResolvedValue({ count: 1 } as never);
    mockOptionFindFirst.mockResolvedValue({ id: 'opt-active' } as never);
    mockOptionUpdateMany.mockResolvedValue({ count: 1 } as never);

    await setOrderPayment('order1', true, [{ mode: 'CASH', amount: 2500 }]);

    expect(mockOptionFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          name: 'Cacahuète vanille',
          available: true,
          group: { productId: 'p1', name: 'Choisissez vos goûts' },
        }),
      })
    );
    // Le décrément cible l'id résolu, jamais un match par nom pouvant
    // toucher plusieurs lignes à la fois (cf. bug historique : un doublon
    // désactivé partageant le nom faisait échouer le paiement à tort).
    expect(mockOptionUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'opt-active' }),
      })
    );
    expect(mockOrderUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isPaid: true }),
      })
    );
  });

  it('refuse le paiement (409) si aucune option disponible ne correspond au nom', async () => {
    mockOrderFindUnique.mockResolvedValue(orderWithOneItem() as never);
    mockProdUpdateMany.mockResolvedValue({ count: 1 } as never);
    mockOptionFindFirst.mockResolvedValue(null);

    await expect(
      setOrderPayment('order1', true, [{ mode: 'CASH', amount: 2500 }])
    ).rejects.toThrow(StockShortageError);
    // Le flip isPaid n'a jamais lieu : rien n'est réservé sur un refus.
    expect(mockOrderUpdateMany).not.toHaveBeenCalled();
  });

  it('refuse le paiement (409) si le stock produit est insuffisant', async () => {
    mockOrderFindUnique.mockResolvedValue(
      orderWithOneItem({ supplements: [] }) as never
    );
    mockProdUpdateMany.mockResolvedValue({ count: 0 } as never);

    await expect(
      setOrderPayment('order1', true, [{ mode: 'CASH', amount: 2500 }])
    ).rejects.toThrow(StockShortageError);
    expect(mockOptionFindFirst).not.toHaveBeenCalled();
    expect(mockOrderUpdateMany).not.toHaveBeenCalled();
  });

  it('refuse le paiement (409) si le stock de l’option est insuffisant', async () => {
    mockOrderFindUnique.mockResolvedValue(orderWithOneItem() as never);
    mockProdUpdateMany.mockResolvedValue({ count: 1 } as never);
    mockOptionFindFirst.mockResolvedValue({ id: 'opt-active' } as never);
    mockOptionUpdateMany.mockResolvedValue({ count: 0 } as never);

    await expect(
      setOrderPayment('order1', true, [{ mode: 'CASH', amount: 2500 }])
    ).rejects.toThrow(StockShortageError);
    expect(mockOrderUpdateMany).not.toHaveBeenCalled();
  });

  it('produit à stock illimité (aucun supplément) : décrémente sans résoudre d’option', async () => {
    mockOrderFindUnique.mockResolvedValue(
      orderWithOneItem({ supplements: [] }) as never
    );
    mockProdUpdateMany.mockResolvedValue({ count: 1 } as never);

    await setOrderPayment('order1', true, [{ mode: 'CASH', amount: 2500 }]);

    expect(mockOptionFindFirst).not.toHaveBeenCalled();
    expect(mockOrderUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isPaid: true }),
      })
    );
  });

  // Une commande déjà COMPLETED (récupérée/servie) avant l'encaissement ne
  // doit pas revalider/décrémenter le stock : l'article a déjà été
  // physiquement consommé, un stock épuisé ENTRE-TEMPS par d'autres
  // commandes ne doit pas bloquer ce paiement rétroactif légitime.
  it('commande déjà COMPLETED : encaisse sans toucher au stock', async () => {
    mockOrderFindUnique.mockResolvedValue(
      orderWithOneItem({}, { status: 'COMPLETED' }) as never
    );

    await setOrderPayment('order1', true, [{ mode: 'CASH', amount: 2500 }]);

    expect(mockProdUpdateMany).not.toHaveBeenCalled();
    expect(mockOptionFindFirst).not.toHaveBeenCalled();
    expect(mockOptionUpdateMany).not.toHaveBeenCalled();
    expect(mockOrderUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isPaid: true }),
      })
    );
  });
});

describe('payAndComplete — même exception pour une commande déjà COMPLETED', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOrderUpdateMany.mockResolvedValue({ count: 1 } as never);
  });

  it('commande déjà COMPLETED (récupérée), pas encore payée : encaisse sans toucher au stock', async () => {
    mockOrderFindUnique.mockResolvedValue(
      orderWithOneItem({}, { status: 'COMPLETED' }) as never
    );

    const result = await payAndComplete(
      'order1',
      [{ mode: 'CASH', amount: 2500 }],
      'ADMIN'
    );

    expect(result).toEqual({ alreadyPaid: false });
    expect(mockProdUpdateMany).not.toHaveBeenCalled();
    expect(mockOptionFindFirst).not.toHaveBeenCalled();
    expect(mockOrderUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'COMPLETED', isPaid: true }),
      })
    );
  });
});

describe('setOrderPayment — paiement fractionné', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOrderUpdateMany.mockResolvedValue({ count: 1 } as never);
    mockProdUpdateMany.mockResolvedValue({ count: 1 } as never);
    mockOptionFindFirst.mockResolvedValue({ id: 'opt-active' } as never);
    mockOptionUpdateMany.mockResolvedValue({ count: 1 } as never);
  });

  it('refuse (400) si la somme des paiements ne correspond pas au total', async () => {
    mockOrderFindUnique.mockResolvedValue(orderWithOneItem() as never);

    await expect(
      setOrderPayment('order1', true, [{ mode: 'CASH', amount: 1000 }])
    ).rejects.toThrow(OrderMutationError);
    expect(mockOrderUpdateMany).not.toHaveBeenCalled();
    expect(mockOrderPaymentCreateMany).not.toHaveBeenCalled();
  });

  it('2 moyens distincts : crée une ligne OrderPayment par moyen et laisse paymentMode=null', async () => {
    mockOrderFindUnique.mockResolvedValue(orderWithOneItem() as never);

    await setOrderPayment('order1', true, [
      { mode: 'CASH', amount: 1000 },
      { mode: 'WAVE', amount: 1500 },
    ]);

    expect(mockOrderUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isPaid: true, paymentMode: null }),
      })
    );
    expect(mockOrderPaymentCreateMany).toHaveBeenCalledWith({
      data: [
        { orderId: 'order1', mode: 'CASH', amount: 1000, createdById: null },
        { orderId: 'order1', mode: 'WAVE', amount: 1500, createdById: null },
      ],
    });
  });

  it('un seul moyen (même fractionné en 2 lignes du même mode) : paymentMode reste renseigné', async () => {
    mockOrderFindUnique.mockResolvedValue(orderWithOneItem() as never);

    await setOrderPayment('order1', true, [
      { mode: 'CASH', amount: 1000 },
      { mode: 'CASH', amount: 1500 },
    ]);

    expect(mockOrderUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isPaid: true, paymentMode: 'CASH' }),
      })
    );
  });
});

describe('setOrderPayment — dépaiement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('supprime les lignes OrderPayment existantes au dépaiement', async () => {
    mockOrderFindUnique.mockResolvedValue({ isPaid: true } as never);
    mockOrderUpdateMany.mockResolvedValue({ count: 1 } as never);

    const result = await setOrderPayment('order1', false);

    expect(result).toEqual({ startedPreparation: false });
    expect(mockOrderUpdateMany).toHaveBeenCalledWith({
      where: { id: 'order1', isPaid: true },
      data: { isPaid: false, paymentMode: null, paidAt: null },
    });
    expect(mockOrderPaymentDeleteMany).toHaveBeenCalledWith({
      where: { orderId: 'order1' },
    });
  });
});

describe('updateOrderFulfillment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refuse (409) sur une commande terminée', async () => {
    mockOrderFindUnique.mockResolvedValue({ status: 'COMPLETED' } as never);

    await expect(
      updateOrderFulfillment('order1', { orderType: 'DELIVERY' })
    ).rejects.toThrow(OrderMutationError);
    expect(mockOrderUpdate).not.toHaveBeenCalled();
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

  it('met à jour orderType/pickupTime/note directement, sans toucher au livreur si absent', async () => {
    mockOrderFindUnique.mockResolvedValue({ status: 'NEW' } as never);
    mockOrderUpdate.mockResolvedValue({} as never);

    await updateOrderFulfillment('order1', {
      orderType: 'DELIVERY',
      pickupTime: '2026-08-01T10:00:00.000Z',
      note: 'Sonner deux fois',
    });

    expect(mockOrderUpdate).toHaveBeenCalledWith({
      where: { id: 'order1' },
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
    mockOrderUpdate.mockResolvedValue({} as never);

    await updateOrderFulfillment('order1', {
      driverName: 'Ibrahim',
      driverPhone: '0708090910',
    });

    expect(mockOrderUpdate).toHaveBeenCalledWith(
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
    mockOrderUpdate.mockResolvedValue({} as never);

    await updateOrderFulfillment('order1', { driverName: 'Ibrahim' });

    expect(mockOrderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          driverName: 'Ibrahim',
          driverPhone: null,
        }),
      })
    );
  });
});
