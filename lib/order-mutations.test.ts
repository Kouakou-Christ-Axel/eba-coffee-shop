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
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      // `getNextDailyNumber` (lib/daily-numbering.ts) lit MAX(dailyNumber).
      aggregate: vi.fn().mockResolvedValue({ _max: { dailyNumber: 4 } }),
    },
    customer: {
      findUnique: vi.fn(),
    },
    orderPayment: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    product: {
      updateMany: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    supplementOption: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
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
  sendPushToRoles: vi.fn().mockResolvedValue(undefined),
}));

// Collaborateurs de `createCashierOrder` sans intérêt pour ce qu'on teste ici
// (résolution du client CRM, fidélité) : neutralisés pour isoler la décision
// « ardoise » et la réservation de stock.
vi.mock('@/lib/customer-mutations', () => ({
  upsertCustomerForOrder: vi.fn().mockResolvedValue('cust-1'),
}));

vi.mock('@/lib/loyalty-mutations', () => ({
  awardLoyaltyForOrder: vi.fn().mockResolvedValue({ rewards: [] }),
  consumeLoyaltyReward: vi.fn().mockResolvedValue(undefined),
  resolveLoyaltyReward: vi.fn().mockResolvedValue(null),
  LoyaltyRewardUnavailableError: class LoyaltyRewardUnavailableError extends Error {},
}));

import prisma from '@/lib/prisma';
import { notifyOrderCustomer, sendPushToRoles } from '@/lib/push-notify';
import { upsertCustomerForOrder } from '@/lib/customer-mutations';
import {
  createCashierOrder,
  setOrderPayment,
  payAndComplete,
  sendOrderToKitchen,
  updateOrderFulfillment,
  setOrderCustomer,
  setOrderLoyaltyReward,
  updateOrderItems,
  OrderMutationError,
  StockShortageError,
} from './order-mutations';
import {
  awardLoyaltyForOrder,
  consumeLoyaltyReward,
  resolveLoyaltyReward,
} from '@/lib/loyalty-mutations';
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
const mockOrderCreate = prisma.order.create as MockedFunction<
  typeof prisma.order.create
>;
const mockCustomerFindUnique = prisma.customer.findUnique as MockedFunction<
  typeof prisma.customer.findUnique
>;
const mockUpsertCustomer = upsertCustomerForOrder as MockedFunction<
  typeof upsertCustomerForOrder
>;
const mockConsumeLoyaltyReward = consumeLoyaltyReward as MockedFunction<
  typeof consumeLoyaltyReward
>;
const mockAwardLoyaltyForOrder = awardLoyaltyForOrder as MockedFunction<
  typeof awardLoyaltyForOrder
>;
const mockResolveLoyaltyReward = resolveLoyaltyReward as MockedFunction<
  typeof resolveLoyaltyReward
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
const mockProdUpdate = prisma.product.update as MockedFunction<
  typeof prisma.product.update
>;
const mockProdFindMany = prisma.product.findMany as MockedFunction<
  typeof prisma.product.findMany
>;
const mockOptionUpdate = prisma.supplementOption.update as MockedFunction<
  typeof prisma.supplementOption.update
>;
const mockOptionFindMany = prisma.supplementOption.findMany as MockedFunction<
  typeof prisma.supplementOption.findMany
>;
const mockNotifyOrderCustomer = notifyOrderCustomer as MockedFunction<
  typeof notifyOrderCustomer
>;
const mockSendPushToRoles = sendPushToRoles as MockedFunction<
  typeof sendPushToRoles
>;

// Deux `order.updateMany` DIFFÉRENTS cohabitent désormais dans un même flux :
//   1. la revendication du verrou de réservation (`where.stockReservedAt: null`,
//      cf. `reserveStockOnce`) ;
//   2. l'écriture de statut / paiement.
// On les discrimine sur `where.stockReservedAt` pour pouvoir simuler « stock
// déjà réservé » (claim `count: 0`) sans casser l'écriture métier.
const isReservationClaim = (args: unknown): boolean =>
  (args as { where?: { stockReservedAt?: unknown } })?.where
    ?.stockReservedAt === null;

/** `claimCount` : 1 = verrou libre (le stock sera décrémenté), 0 = déjà réservé. */
function mockOrderUpdateManyWithClaim(claimCount: 0 | 1): void {
  mockOrderUpdateMany.mockImplementation((async (args: unknown) =>
    isReservationClaim(args) ? { count: claimCount } : { count: 1 }) as never);
}

/** Les `order.updateMany` métier (statut / paiement), hors revendication. */
const businessWrites = () =>
  mockOrderUpdateMany.mock.calls.filter(([args]) => !isReservationClaim(args));

const orderWithOneItem = (
  item: Partial<CartItem> = {},
  orderOverrides: { status?: string; total?: number } = {}
) => ({
  isPaid: false,
  status: 'NEW',
  total: 2500,
  dailyNumber: 3,
  reference: 'EBA-20260804-A3F9',
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

describe('setOrderPayment — réservation du stock à l’entrée en cuisine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Commande NEW : l'encaissement la pousse en cuisine, donc réserve.
    mockOrderUpdateManyWithClaim(1);
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
          group: {
            name: 'Choisissez vos goûts',
            OR: [{ productId: 'p1' }, { isGlobal: true }],
          },
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
    // Le flip isPaid n'a jamais lieu : rien n'est encaissé sur un refus. (La
    // revendication du verrou, elle, a bien été émise — le rollback de la
    // transaction l'annule.)
    expect(businessWrites()).toHaveLength(0);
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
    expect(businessWrites()).toHaveLength(0);
  });

  it('refuse le paiement (409) si le stock de l’option est insuffisant', async () => {
    mockOrderFindUnique.mockResolvedValue(orderWithOneItem() as never);
    mockProdUpdateMany.mockResolvedValue({ count: 1 } as never);
    mockOptionFindFirst.mockResolvedValue({ id: 'opt-active' } as never);
    mockOptionUpdateMany.mockResolvedValue({ count: 0 } as never);

    await expect(
      setOrderPayment('order1', true, [{ mode: 'CASH', amount: 2500 }])
    ).rejects.toThrow(StockShortageError);
    expect(businessWrites()).toHaveLength(0);
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

  // Encaisser une commande qui n'est plus NEW (déjà en cuisine, prête ou
  // récupérée) est PUREMENT financier : plus aucun appel stock, même pas la
  // revendication du verrou. C'est la nouvelle règle — l'ancienne exception
  // « ne pas décrémenter si COMPLETED » est subsumée par `stockReservedAt`.
  it('commande déjà COMPLETED : encaisse sans aucun appel stock', async () => {
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

  it('commande déjà en cuisine (PREPARING) : l’encaissement ne touche pas au stock', async () => {
    mockOrderFindUnique.mockResolvedValue(
      orderWithOneItem({}, { status: 'PREPARING' }) as never
    );

    const result = await setOrderPayment('order1', true, [
      { mode: 'CASH', amount: 2500 },
    ]);

    expect(result).toEqual({ startedPreparation: false });
    // Ni revendication du verrou, ni décrément : le stock a été réservé à
    // l'entrée en cuisine, l'encaissement n'est plus qu'un mouvement d'argent.
    expect(
      mockOrderUpdateMany.mock.calls.filter(([args]) =>
        isReservationClaim(args)
      )
    ).toHaveLength(0);
    expect(mockProdUpdateMany).not.toHaveBeenCalled();
    expect(mockOptionFindFirst).not.toHaveBeenCalled();
  });
});

describe('payAndComplete — réservation inconditionnelle du stock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProdUpdateMany.mockResolvedValue({ count: 1 } as never);
    mockOptionFindFirst.mockResolvedValue({ id: 'opt-active' } as never);
    mockOptionUpdateMany.mockResolvedValue({ count: 1 } as never);
  });

  // NEW → COMPLETED ne passe jamais par PREPARING, mais la marchandise est
  // bien servie : elle doit être décomptée.
  it('commande NEW : réserve le stock puis finalise en un geste', async () => {
    mockOrderUpdateManyWithClaim(1);
    mockOrderFindUnique.mockResolvedValue(orderWithOneItem() as never);

    const result = await payAndComplete(
      'order1',
      [{ mode: 'CASH', amount: 2500 }],
      'ADMIN'
    );

    expect(result).toEqual({ alreadyPaid: false });
    expect(mockOrderUpdateMany).toHaveBeenCalledWith({
      where: { id: 'order1', stockReservedAt: null },
      data: { stockReservedAt: expect.any(Date) },
    });
    expect(mockProdUpdateMany).toHaveBeenCalledTimes(1);
    expect(businessWrites()).toHaveLength(1);
    expect(mockOrderUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'COMPLETED', isPaid: true }),
      })
    );
  });

  // Ancienne exception « déjà COMPLETED ⇒ pas de décrément » : elle n'existe
  // plus en tant que telle, c'est le verrou `stockReservedAt` qui tranche.
  it('commande déjà COMPLETED dont le stock est déjà réservé : encaisse sans décrémenter', async () => {
    mockOrderUpdateManyWithClaim(0);
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

describe('sendOrderToKitchen — entrée en cuisine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProdUpdateMany.mockResolvedValue({ count: 1 } as never);
    mockOptionFindFirst.mockResolvedValue({ id: 'opt-active' } as never);
    mockOptionUpdateMany.mockResolvedValue({ count: 1 } as never);
  });

  it('réserve le stock et pousse la commande en PREPARING', async () => {
    mockOrderUpdateManyWithClaim(1);
    mockOrderFindUnique.mockResolvedValue(orderWithOneItem() as never);

    await sendOrderToKitchen('order1', 'ADMIN');

    expect(mockOrderUpdateMany).toHaveBeenCalledWith({
      where: { id: 'order1', stockReservedAt: null },
      data: { stockReservedAt: expect.any(Date) },
    });
    expect(mockProdUpdateMany).toHaveBeenCalledTimes(1);
    expect(mockOrderUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order1', status: 'NEW' },
        data: expect.objectContaining({
          status: 'PREPARING',
          preparingStartedAt: expect.any(Date),
        }),
      })
    );
    // Pas d'ardoise sans `onAccount` : le champ n'est même pas écrit.
    expect(businessWrites()[0][0]).not.toHaveProperty('data.isOnAccount');
  });

  it('entrer deux fois en cuisine ne décrémente le stock qu’une seule fois', async () => {
    // 1er envoi : le verrou est libre, le stock part.
    mockOrderUpdateManyWithClaim(1);
    mockOrderFindUnique.mockResolvedValue(orderWithOneItem() as never);
    await sendOrderToKitchen('order1', 'ADMIN');
    expect(mockProdUpdateMany).toHaveBeenCalledTimes(1);

    // 2e envoi (undo PREPARING → NEW puis renvoi) : la revendication renvoie
    // count: 0, donc plus AUCUN décrément — mais le statut est bien réécrit.
    mockProdUpdateMany.mockClear();
    mockOptionUpdateMany.mockClear();
    mockOrderUpdateManyWithClaim(0);
    await sendOrderToKitchen('order1', 'ADMIN');

    expect(mockProdUpdateMany).not.toHaveBeenCalled();
    expect(mockOptionUpdateMany).not.toHaveBeenCalled();
    expect(mockOrderUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PREPARING' }),
      })
    );
  });

  it('marque isOnAccount quand l’envoi est une ardoise', async () => {
    mockOrderUpdateManyWithClaim(1);
    mockOrderFindUnique.mockResolvedValue(orderWithOneItem() as never);

    await sendOrderToKitchen('order1', 'ADMIN', { onAccount: true });

    expect(mockOrderUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'PREPARING',
          isOnAccount: true,
        }),
      })
    );
  });

  it('pénurie : rollback (aucune écriture de statut) et notification ITEM_UNAVAILABLE', async () => {
    mockOrderUpdateManyWithClaim(1);
    mockOrderFindUnique.mockResolvedValue(
      orderWithOneItem({ supplements: [] }) as never
    );
    mockProdUpdateMany.mockResolvedValue({ count: 0 } as never);

    await expect(sendOrderToKitchen('order1', 'ADMIN')).rejects.toThrow(
      StockShortageError
    );

    expect(businessWrites()).toHaveLength(0);
    expect(mockNotifyOrderCustomer).toHaveBeenCalledWith(
      'order1',
      'ITEM_UNAVAILABLE'
    );
    expect(mockNotifyOrderCustomer).not.toHaveBeenCalledWith(
      'order1',
      'PREPARING'
    );
  });

  it('refuse (403) une transition non autorisée pour le rôle', async () => {
    mockOrderUpdateManyWithClaim(1);
    mockOrderFindUnique.mockResolvedValue(
      orderWithOneItem({}, { status: 'READY' }) as never
    );

    // READY → PREPARING est réservé à KITCHEN_PLUS : COMPTABLE n'y a pas droit.
    await expect(sendOrderToKitchen('order1', 'COMPTABLE')).rejects.toThrow(
      OrderMutationError
    );
    expect(mockOrderUpdateMany).not.toHaveBeenCalled();
  });

  it('lève (404) si la commande est introuvable', async () => {
    mockOrderFindUnique.mockResolvedValue(null);

    await expect(sendOrderToKitchen('order1', 'ADMIN')).rejects.toThrow(
      OrderMutationError
    );
  });
});

describe('notification push cuisine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProdUpdateMany.mockResolvedValue({ count: 1 } as never);
    mockOptionFindFirst.mockResolvedValue({ id: 'opt-active' } as never);
    mockOptionUpdateMany.mockResolvedValue({ count: 1 } as never);
    mockOrderUpdateManyWithClaim(1);
  });

  const kitchenPush = () =>
    mockSendPushToRoles.mock.calls.find(
      ([, payload]) => payload.tag === 'order-kitchen-order1'
    );

  it('cible le staff cuisine (KITCHEN) et JAMAIS le caissier (déjà notifié)', async () => {
    mockOrderFindUnique.mockResolvedValue(orderWithOneItem() as never);

    await sendOrderToKitchen('order1', 'ADMIN');

    const call = kitchenPush();
    expect(call).toBeDefined();
    const [roles, payload] = call as [string[], { body: string; url?: string }];
    expect(roles).toContain('KITCHEN');
    expect(roles).not.toContain('CASHIER');
    expect(payload.url).toBe('/dashboard/preparation');
    expect(payload.body).toBe('#003 · A3F9 · 1 article');
  });

  it('l’encaissement qui pousse une commande NEW en cuisine notifie aussi la cuisine', async () => {
    mockOrderFindUnique.mockResolvedValue(orderWithOneItem() as never);

    await setOrderPayment('order1', true, [{ mode: 'CASH', amount: 2500 }]);

    expect(kitchenPush()).toBeDefined();
  });

  it('encaisser une commande déjà en cuisine ne renotifie pas la cuisine', async () => {
    mockOrderFindUnique.mockResolvedValue(
      orderWithOneItem({}, { status: 'PREPARING' }) as never
    );

    await setOrderPayment('order1', true, [{ mode: 'CASH', amount: 2500 }]);

    expect(kitchenPush()).toBeUndefined();
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
      data: {
        isPaid: false,
        paymentMode: null,
        paidAt: null,
        paymentAutoValidatedByAi: false,
      },
    });
    expect(mockOrderPaymentDeleteMany).toHaveBeenCalledWith({
      where: { orderId: 'order1' },
    });
  });
});

describe('createCashierOrder — ardoise du client de confiance', () => {
  const items = orderWithOneItem().items as unknown as CartItem[];

  /** Données passées à `order.create` au dernier appel. */
  const createdData = () =>
    (
      mockOrderCreate.mock.calls.at(-1)?.[0] as {
        data: Record<string, unknown>;
      }
    ).data;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUpsertCustomer.mockResolvedValue('cust-1');
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
    mockOrderUpdateManyWithClaim(1);
    mockProdUpdateMany.mockResolvedValue({ count: 1 } as never);
    mockOptionFindFirst.mockResolvedValue({ id: 'opt-active' } as never);
    mockOptionUpdateMany.mockResolvedValue({ count: 1 } as never);
  });

  it('client de confiance : commande créée directement en PREPARING, sur ardoise, stock réservé', async () => {
    mockCustomerFindUnique.mockResolvedValue({ isTrusted: true } as never);

    await createCashierOrder({
      items,
      customerName: 'Awa',
      customerPhone: '0708090910',
      orderType: 'TAKEAWAY',
    });

    expect(createdData()).toMatchObject({
      status: 'PREPARING',
      preparingStartedAt: expect.any(Date),
      isOnAccount: true,
    });
    // Jamais payée : l'ardoise n'est pas un encaissement (le CA ne compte que
    // `isPaid`, cf. lib/stats.ts).
    expect(createdData()).not.toHaveProperty('isPaid');
    // Stock réservé dans la même transaction que la création.
    expect(mockOrderUpdateMany).toHaveBeenCalledWith({
      where: { id: 'order-new', stockReservedAt: null },
      data: { stockReservedAt: expect.any(Date) },
    });
    expect(mockProdUpdateMany).toHaveBeenCalledTimes(1);
  });

  it('client de confiance : la cuisine est prévenue, pas seulement la caisse', async () => {
    mockCustomerFindUnique.mockResolvedValue({ isTrusted: true } as never);

    await createCashierOrder({
      items,
      customerPhone: '0708090910',
      orderType: 'TAKEAWAY',
    });

    expect(
      mockSendPushToRoles.mock.calls.find(
        ([, payload]) => payload.tag === 'order-kitchen-order-new'
      )
    ).toBeDefined();
  });

  it('client ordinaire : commande créée en NEW, sans ardoise ni réservation', async () => {
    mockCustomerFindUnique.mockResolvedValue({ isTrusted: false } as never);

    await createCashierOrder({
      items,
      customerPhone: '0708090910',
      orderType: 'TAKEAWAY',
    });

    expect(createdData()).not.toHaveProperty('status');
    expect(createdData()).not.toHaveProperty('isOnAccount');
    expect(mockProdUpdateMany).not.toHaveBeenCalled();
  });

  it('`onAccount` force l’ardoise pour un client non fiché de confiance', async () => {
    mockCustomerFindUnique.mockResolvedValue({ isTrusted: false } as never);

    await createCashierOrder({
      items,
      customerPhone: '0708090910',
      orderType: 'TAKEAWAY',
      onAccount: true,
    });

    expect(createdData()).toMatchObject({
      status: 'PREPARING',
      isOnAccount: true,
    });
  });

  it('commande ANTIDATÉE d’un client de confiance : PAS d’envoi auto en cuisine', async () => {
    // Une saisie de rattrapage n'est pas un événement en direct : elle ne doit
    // ni réveiller la cuisine ni décrémenter le stock d'aujourd'hui — même
    // garde que le push « nouvelle commande ».
    mockCustomerFindUnique.mockResolvedValue({ isTrusted: true } as never);

    await createCashierOrder({
      items,
      customerPhone: '0708090910',
      orderType: 'TAKEAWAY',
      orderDate: '2026-01-05',
    });

    expect(createdData()).not.toHaveProperty('status');
    expect(createdData()).not.toHaveProperty('isOnAccount');
    expect(createdData()).toHaveProperty('createdAt');
    expect(mockProdUpdateMany).not.toHaveBeenCalled();
    expect(mockSendPushToRoles).not.toHaveBeenCalled();
  });

  it('commande anonyme (sans téléphone) : jamais d’ardoise implicite', async () => {
    mockUpsertCustomer.mockResolvedValue(null);

    await createCashierOrder({ items, orderType: 'TAKEAWAY' });

    expect(mockCustomerFindUnique).not.toHaveBeenCalled();
    expect(createdData()).not.toHaveProperty('isOnAccount');
  });

  it('pénurie de stock : la création entière est annulée (rien n’est écrit)', async () => {
    mockCustomerFindUnique.mockResolvedValue({ isTrusted: true } as never);
    mockProdUpdateMany.mockResolvedValue({ count: 0 } as never);

    await expect(
      createCashierOrder({
        items,
        customerPhone: '0708090910',
        orderType: 'TAKEAWAY',
      })
    ).rejects.toThrow(StockShortageError);
  });
});

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
      orderType: 'TAKEAWAY',
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
      orderType: 'TAKEAWAY',
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

/** Demain, exprimé en ISO — le prédicat raisonne en jours civils Abidjan. */
function tomorrowIso(hour = 10): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
}

/** Plus tard aujourd'hui : lointain, mais PAS un autre jour civil. */
function laterTodayIso(): string {
  const d = new Date();
  d.setUTCHours(23, 30, 0, 0);
  return d.toISOString();
}

describe('commande différée — création en caisse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOrderUpdateManyWithClaim(1);
    mockUpsertCustomer.mockResolvedValue('cust-1');
    mockCustomerFindUnique.mockResolvedValue({ isTrusted: true } as never);
    mockOrderCreate.mockImplementation((async (args: {
      data: Record<string, unknown>;
    }) => ({
      id: 'order-new',
      dailyNumber: 5,
      reference: 'EBA-20260804-B1C2',
      total: 2500,
      customerName: null,
      status: args.data.status ?? 'NEW',
      pickupTime: args.data.pickupTime ?? null,
      items: args.data.items,
    })) as never);
  });

  const items = [
    {
      cartId: 'c1',
      productId: 'p1',
      productName: 'Sponge cake',
      basePrice: 2500,
      coutMatiere: 0,
      coutEmballage: 0,
      quantity: 1,
      supplements: [],
      discount: 0,
      discountReason: null,
    },
  ] as CartItem[];

  it('client de confiance + retrait demain : reste NEW, aucun décrément de stock', async () => {
    await createCashierOrder({
      items,
      orderType: 'TAKEAWAY',
      customerPhone: '0700000000',
      pickupTime: tomorrowIso(),
    });

    expect(mockOrderCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ status: 'PREPARING' }),
      })
    );
    // Le stock d'aujourd'hui n'a pas bougé : la marchandise sera produite demain.
    expect(mockProdUpdateMany).not.toHaveBeenCalled();
    // `isOnAccount` n'est pas posé non plus : rien n'est parti en cuisine.
    expect(mockOrderCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ isOnAccount: true }),
      })
    );
  });

  it('non-régression — client de confiance + retrait TARDIF LE JOUR MÊME : part en cuisine et décompte', async () => {
    mockProdUpdateMany.mockResolvedValue({ count: 1 } as never);

    await createCashierOrder({
      items,
      orderType: 'TAKEAWAY',
      customerPhone: '0700000000',
      pickupTime: laterTodayIso(),
    });

    expect(mockOrderCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'PREPARING',
          isOnAccount: true,
        }),
      })
    );
    expect(mockProdUpdateMany).toHaveBeenCalled();
  });
});

describe('commande différée — encaissement purement financier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOrderUpdateManyWithClaim(1);
  });

  it('encaisser une commande NEW pour demain : ni PREPARING, ni décrément', async () => {
    mockOrderFindUnique.mockResolvedValue({
      ...orderWithOneItem(),
      pickupTime: new Date(tomorrowIso()),
    } as never);
    mockOrderPaymentCreateMany.mockResolvedValue({ count: 1 } as never);

    const res = await setOrderPayment('order1', true, [
      { mode: 'CASH', amount: 2500 },
    ]);

    expect(res.startedPreparation).toBe(false);
    expect(mockProdUpdateMany).not.toHaveBeenCalled();
    expect(mockOptionUpdateMany).not.toHaveBeenCalled();
    // Le paiement, lui, est bien écrit : c'est un encaissement, pas un refus.
    expect(businessWrites()[0]?.[0]).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({ isPaid: true }),
      })
    );
    expect(businessWrites()[0]?.[0]).toEqual(
      expect.objectContaining({
        data: expect.not.objectContaining({ status: 'PREPARING' }),
      })
    );
  });

  it('non-régression — encaisser une commande NEW du jour la pousse toujours en cuisine', async () => {
    mockOrderFindUnique.mockResolvedValue({
      ...orderWithOneItem(),
      pickupTime: null,
    } as never);
    mockProdUpdateMany.mockResolvedValue({ count: 1 } as never);
    mockOptionFindFirst.mockResolvedValue({ id: 'opt-1' } as never);
    mockOptionUpdateMany.mockResolvedValue({ count: 1 } as never);
    mockOrderPaymentCreateMany.mockResolvedValue({ count: 1 } as never);

    const res = await setOrderPayment('order1', true, [
      { mode: 'CASH', amount: 2500 },
    ]);

    expect(res.startedPreparation).toBe(true);
    expect(mockProdUpdateMany).toHaveBeenCalled();
  });
});

describe('payAndComplete — refus explicite sur une commande différée', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOrderUpdateManyWithClaim(1);
  });

  it('refuse « payer + récupérer » tant que rien n’a été produit', async () => {
    mockOrderFindUnique.mockResolvedValue({
      ...orderWithOneItem(),
      pickupTime: new Date(tomorrowIso()),
      stockReservedAt: null,
    } as never);

    await expect(
      payAndComplete('order1', [{ mode: 'CASH', amount: 2500 }], 'ADMIN')
    ).rejects.toThrow(/Retrait prévu/);
    expect(mockProdUpdateMany).not.toHaveBeenCalled();
  });

  it('l’autorise si la commande a été PRÉPARÉE EN AVANCE (stock déjà réservé)', async () => {
    mockOrderFindUnique.mockResolvedValue({
      ...orderWithOneItem(),
      pickupTime: new Date(tomorrowIso()),
      stockReservedAt: new Date(),
    } as never);
    mockOrderUpdateManyWithClaim(0); // déjà réservé : le verrou ne se reprend pas
    mockOrderPaymentCreateMany.mockResolvedValue({ count: 1 } as never);

    await expect(
      payAndComplete('order1', [{ mode: 'CASH', amount: 2500 }], 'ADMIN')
    ).resolves.toEqual({ alreadyPaid: false });
  });
});

// ─── Couverture de pénurie : le staff confirme avoir produit ──────────────────

describe('coverShortage — crédite le manquant puis réserve (net nul)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOrderUpdateManyWithClaim(1);
  });

  it('crédite EXACTEMENT ce qui manque, produit et goût, avant de décompter', async () => {
    mockOrderFindUnique.mockResolvedValue(orderWithOneItem() as never);
    // Stock courant : 0 produit, 1 goût — il faut 1 produit et 3 goûts.
    mockProdFindMany.mockResolvedValue([
      { id: 'p1', stockQuantity: 0 },
    ] as never);
    mockOptionFindMany.mockResolvedValue([
      { id: 'opt-1', stockQuantity: 1 },
    ] as never);
    mockOptionFindFirst.mockResolvedValue({ id: 'opt-1' } as never);
    mockProdUpdate.mockResolvedValue({} as never);
    mockOptionUpdate.mockResolvedValue({} as never);
    mockProdUpdateMany.mockResolvedValue({ count: 1 } as never);
    mockOptionUpdateMany.mockResolvedValue({ count: 1 } as never);

    await sendOrderToKitchen('order1', 'ADMIN', { coverShortage: true });

    expect(mockProdUpdate).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { stockQuantity: { increment: 1 } },
    });
    expect(mockOptionUpdate).toHaveBeenCalledWith({
      where: { id: 'opt-1' },
      data: { stockQuantity: { increment: 2 } },
    });
    // Puis le décrément normal : effet net nul sur le stock.
    expect(mockProdUpdateMany).toHaveBeenCalled();
  });

  it('ne crédite rien sur une cible à stock illimité (jamais en pénurie)', async () => {
    mockOrderFindUnique.mockResolvedValue(orderWithOneItem() as never);
    mockProdFindMany.mockResolvedValue([
      { id: 'p1', stockQuantity: null },
    ] as never);
    mockOptionFindMany.mockResolvedValue([
      { id: 'opt-1', stockQuantity: null },
    ] as never);
    mockOptionFindFirst.mockResolvedValue({ id: 'opt-1' } as never);
    mockProdUpdateMany.mockResolvedValue({ count: 1 } as never);
    mockOptionUpdateMany.mockResolvedValue({ count: 1 } as never);

    await sendOrderToKitchen('order1', 'ADMIN', { coverShortage: true });

    expect(mockProdUpdate).not.toHaveBeenCalled();
    expect(mockOptionUpdate).not.toHaveBeenCalled();
  });

  it('sans confirmation, une pénurie reste un refus', async () => {
    mockOrderFindUnique.mockResolvedValue(orderWithOneItem() as never);
    mockProdUpdateMany.mockResolvedValue({ count: 0 } as never);

    await expect(sendOrderToKitchen('order1', 'ADMIN')).rejects.toBeInstanceOf(
      StockShortageError
    );
    expect(mockProdUpdate).not.toHaveBeenCalled();
  });
});

// ─── Édition d'articles : le stock suit le contenu réel de la commande ────────

describe('updateOrderItems — resynchronisation du stock', () => {
  const line = (quantity: number, optionQuantity = 3) => ({
    cartId: 'c1',
    productId: 'p1',
    productName: 'Tartelettes x3',
    basePrice: 2500,
    coutMatiere: 0,
    coutEmballage: 0,
    quantity,
    supplements: [
      {
        groupName: 'Choisissez vos goûts',
        optionName: 'Cacahuète vanille',
        price: 0,
        quantity: optionQuantity,
      },
    ],
    discount: 0,
    discountReason: null,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockOptionFindFirst.mockResolvedValue({ id: 'opt-1' } as never);
    mockOrderUpdate.mockResolvedValue({} as never);
    mockProdUpdateMany.mockResolvedValue({ count: 1 } as never);
    mockOptionUpdateMany.mockResolvedValue({ count: 1 } as never);
    mockProdUpdate.mockResolvedValue({} as never);
    mockOptionUpdate.mockResolvedValue({} as never);
  });

  it('ne touche à rien tant que la commande n’a pas réservé', async () => {
    mockOrderFindUnique.mockResolvedValue({
      status: 'NEW',
      loyaltyDiscount: null,
      stockReservedAt: null,
      items: [line(1)],
    } as never);

    await updateOrderItems('order1', [line(3)] as CartItem[]);

    expect(mockProdUpdateMany).not.toHaveBeenCalled();
    expect(mockProdUpdate).not.toHaveBeenCalled();
  });

  it('décompte le delta AJOUTÉ sur une commande déjà en cuisine', async () => {
    mockOrderFindUnique.mockResolvedValue({
      status: 'PREPARING',
      loyaltyDiscount: null,
      stockReservedAt: new Date(),
      items: [line(1)],
    } as never);

    await updateOrderItems('order1', [line(3)] as CartItem[]);

    // 3 − 1 = 2 unités de plus, et 9 − 3 = 6 goûts de plus.
    expect(mockProdUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { stockQuantity: { decrement: 2 } },
      })
    );
    expect(mockOptionUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { stockQuantity: { decrement: 6 } },
      })
    );
  });

  it('REND au stock ce qui est retiré — un article non consommé doit redevenir vendable', async () => {
    mockOrderFindUnique.mockResolvedValue({
      status: 'PREPARING',
      loyaltyDiscount: null,
      stockReservedAt: new Date(),
      items: [line(3)],
    } as never);

    await updateOrderItems('order1', [line(1)] as CartItem[]);

    expect(mockProdUpdate).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { stockQuantity: { increment: 2 } },
    });
    expect(mockOptionUpdate).toHaveBeenCalledWith({
      where: { id: 'opt-1' },
      data: { stockQuantity: { increment: 6 } },
    });
  });

  it('ne rend rien si le staff indique que l’article était déjà préparé', async () => {
    mockOrderFindUnique.mockResolvedValue({
      status: 'PREPARING',
      loyaltyDiscount: null,
      stockReservedAt: new Date(),
      items: [line(3)],
    } as never);

    await updateOrderItems('order1', [line(1)] as CartItem[], {
      restoreRemovedStock: false,
    });

    expect(mockProdUpdate).not.toHaveBeenCalled();
    expect(mockOptionUpdate).not.toHaveBeenCalled();
  });

  it('rejouer la même modification ne crédite pas deux fois (delta calculé sur l’état persisté)', async () => {
    // Deuxième appel : les articles persistés sont DÉJÀ ceux qu'on envoie.
    mockOrderFindUnique.mockResolvedValue({
      status: 'PREPARING',
      loyaltyDiscount: null,
      stockReservedAt: new Date(),
      items: [line(1)],
    } as never);

    await updateOrderItems('order1', [line(1)] as CartItem[]);

    expect(mockProdUpdate).not.toHaveBeenCalled();
    expect(mockProdUpdateMany).not.toHaveBeenCalled();
  });
});

// Couverture reprise de la correction parallèle de `master` (« Décrémente le
// stock sur une hausse de quantité après l'entrée en cuisine »), qui traitait
// le même bug par le seul côté HAUSSE. Ces cas restent valides et complètent
// les précédents ; le seul qu'elle affirmait — « une baisse ne restitue rien »
// — a été délibérément inversé : un article retiré d'une commande vivante n'a
// pas été consommé, le laisser décompté fait mentir le stock (cf. le test
// « REND au stock ce qui est retiré » plus haut).
describe('updateOrderItems — delta de stock, cas complémentaires', () => {
  const productItem = (overrides: Partial<CartItem> = {}): CartItem => ({
    cartId: 'c1',
    productId: 'p1',
    productName: 'Cappuccino',
    basePrice: 1500,
    coutMatiere: 0,
    coutEmballage: 0,
    quantity: 1,
    supplements: [],
    discount: 0,
    discountReason: null,
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockOrderUpdate.mockResolvedValue({} as never);
    mockProdUpdateMany.mockResolvedValue({ count: 1 } as never);
    mockOptionFindFirst.mockResolvedValue({ id: 'opt-active' } as never);
    mockOptionUpdateMany.mockResolvedValue({ count: 1 } as never);
  });

  it('commande PAS encore réservée : aucun appel stock, juste items/total mis à jour', async () => {
    mockOrderFindUnique.mockResolvedValue({
      status: 'NEW',
      loyaltyDiscount: 0,
      items: [productItem({ quantity: 1 })],
      stockReservedAt: null,
    } as never);

    const result = await updateOrderItems('order1', [
      productItem({ quantity: 5 }),
    ]);

    expect(result).toEqual({ total: 7500 });
    expect(mockProdUpdateMany).not.toHaveBeenCalled();
    expect(mockOrderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ total: 7500 }),
      })
    );
  });

  it('un article tout juste ajouté décrémente sa quantité complète', async () => {
    mockOrderFindUnique.mockResolvedValue({
      status: 'PREPARING',
      loyaltyDiscount: 0,
      items: [productItem({ quantity: 1 })],
      stockReservedAt: new Date('2026-08-13T10:00:00Z'),
    } as never);

    await updateOrderItems('order1', [
      productItem({ quantity: 1 }),
      productItem({
        cartId: 'c2',
        productId: 'p2',
        productName: 'Croissant',
        basePrice: 800,
        quantity: 2,
        addedLater: true,
      }),
    ]);

    expect(mockProdUpdateMany).toHaveBeenCalledTimes(1);
    expect(mockProdUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'p2' }),
        data: { stockQuantity: { decrement: 2 } },
      })
    );
  });

  it('le delta d’un supplément est décrémenté', async () => {
    const supplement = {
      groupName: 'Lait',
      optionName: 'Amande',
      price: 200,
      quantity: 1,
    };
    mockOrderFindUnique.mockResolvedValue({
      status: 'PREPARING',
      loyaltyDiscount: 0,
      items: [productItem({ quantity: 1, supplements: [supplement] })],
      stockReservedAt: new Date('2026-08-13T10:00:00Z'),
    } as never);

    await updateOrderItems('order1', [
      productItem({ quantity: 3, supplements: [supplement] }),
    ]);

    // Produit : 3 − 1 = 2. Supplément (besoin = quantité × qté de ligne) :
    // 1×3 − 1×1 = 2.
    expect(mockOptionUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'opt-active' }),
        data: { stockQuantity: { decrement: 2 } },
      })
    );
  });

  it('pénurie sur le delta : lève StockShortageError et n’écrit rien', async () => {
    mockOrderFindUnique.mockResolvedValue({
      status: 'PREPARING',
      loyaltyDiscount: 0,
      items: [productItem({ quantity: 1 })],
      stockReservedAt: new Date('2026-08-13T10:00:00Z'),
    } as never);
    mockProdUpdateMany.mockResolvedValue({ count: 0 } as never);

    await expect(
      updateOrderItems('order1', [productItem({ quantity: 3 })])
    ).rejects.toThrow(StockShortageError);
    expect(mockOrderUpdate).not.toHaveBeenCalled();
  });

  it('refuse (409) sur une commande terminée', async () => {
    mockOrderFindUnique.mockResolvedValue({
      status: 'COMPLETED',
      loyaltyDiscount: 0,
      items: [productItem()],
      stockReservedAt: new Date('2026-08-13T10:00:00Z'),
    } as never);

    await expect(
      updateOrderItems('order1', [productItem({ quantity: 2 })])
    ).rejects.toThrow(OrderMutationError);
    expect(mockProdUpdateMany).not.toHaveBeenCalled();
  });

  it('lève (404) si la commande est introuvable', async () => {
    mockOrderFindUnique.mockResolvedValue(null);

    await expect(updateOrderItems('order1', [productItem()])).rejects.toThrow(
      OrderMutationError
    );
  });
});
