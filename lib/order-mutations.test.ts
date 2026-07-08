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
      findMany: vi.fn().mockResolvedValue([]),
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
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn(client)
    ),
  };
  return { default: client };
});

vi.mock('@/lib/push-notify', () => ({
  notifyOrderCustomer: vi.fn(),
  sendPushToRoles: vi.fn(),
}));

import prisma from '@/lib/prisma';
import { setOrderPayment, StockShortageError } from './order-mutations';
import type { CartItem } from '@/lib/cart-store';

const mockOrderFindUnique = prisma.order.findUnique as MockedFunction<
  typeof prisma.order.findUnique
>;
const mockOrderUpdateMany = prisma.order.updateMany as MockedFunction<
  typeof prisma.order.updateMany
>;
const mockProdUpdateMany = prisma.product.updateMany as MockedFunction<
  typeof prisma.product.updateMany
>;
const mockOptionFindFirst = prisma.supplementOption.findFirst as MockedFunction<
  typeof prisma.supplementOption.findFirst
>;
const mockOptionUpdateMany = prisma.supplementOption
  .updateMany as MockedFunction<typeof prisma.supplementOption.updateMany>;

const orderWithOneItem = (item: Partial<CartItem> = {}) => ({
  isPaid: false,
  status: 'NEW',
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

    await setOrderPayment('order1', true, 'CASH');

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

    await expect(setOrderPayment('order1', true, 'CASH')).rejects.toThrow(
      StockShortageError
    );
    // Le flip isPaid n'a jamais lieu : rien n'est réservé sur un refus.
    expect(mockOrderUpdateMany).not.toHaveBeenCalled();
  });

  it('refuse le paiement (409) si le stock produit est insuffisant', async () => {
    mockOrderFindUnique.mockResolvedValue(
      orderWithOneItem({ supplements: [] }) as never
    );
    mockProdUpdateMany.mockResolvedValue({ count: 0 } as never);

    await expect(setOrderPayment('order1', true, 'CASH')).rejects.toThrow(
      StockShortageError
    );
    expect(mockOptionFindFirst).not.toHaveBeenCalled();
    expect(mockOrderUpdateMany).not.toHaveBeenCalled();
  });

  it('refuse le paiement (409) si le stock de l’option est insuffisant', async () => {
    mockOrderFindUnique.mockResolvedValue(orderWithOneItem() as never);
    mockProdUpdateMany.mockResolvedValue({ count: 1 } as never);
    mockOptionFindFirst.mockResolvedValue({ id: 'opt-active' } as never);
    mockOptionUpdateMany.mockResolvedValue({ count: 0 } as never);

    await expect(setOrderPayment('order1', true, 'CASH')).rejects.toThrow(
      StockShortageError
    );
    expect(mockOrderUpdateMany).not.toHaveBeenCalled();
  });

  it('produit à stock illimité (aucun supplément) : décrémente sans résoudre d’option', async () => {
    mockOrderFindUnique.mockResolvedValue(
      orderWithOneItem({ supplements: [] }) as never
    );
    mockProdUpdateMany.mockResolvedValue({ count: 1 } as never);

    await setOrderPayment('order1', true, 'CASH');

    expect(mockOptionFindFirst).not.toHaveBeenCalled();
    expect(mockOrderUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isPaid: true }),
      })
    );
  });
});
