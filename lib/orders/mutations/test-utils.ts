// Mocks typés et helpers partagés ; à importer APRÈS les `vi.mock` du test.

import { type MockedFunction } from 'vitest';
import prisma from '@/lib/prisma';
import { notifyOrderCustomer, sendPushToRoles } from '@/lib/push-notify';
import { upsertCustomerForOrder } from '@/lib/customer-mutations';
import {
  consumeLoyaltyReward,
  awardLoyaltyForOrder,
  resolveLoyaltyReward,
} from '@/lib/loyalty-mutations';
import type { CartItem } from '@/lib/cart-store';

export const mockOrderFindUnique = prisma.order.findUnique as MockedFunction<
  typeof prisma.order.findUnique
>;
export const mockOrderUpdateMany = prisma.order.updateMany as MockedFunction<
  typeof prisma.order.updateMany
>;
export const mockOrderUpdate = prisma.order.update as MockedFunction<
  typeof prisma.order.update
>;
export const mockOrderCreate = prisma.order.create as MockedFunction<
  typeof prisma.order.create
>;
export const mockCustomerFindUnique = prisma.customer
  .findUnique as MockedFunction<typeof prisma.customer.findUnique>;
export const mockUpsertCustomer = upsertCustomerForOrder as MockedFunction<
  typeof upsertCustomerForOrder
>;
export const mockConsumeLoyaltyReward = consumeLoyaltyReward as MockedFunction<
  typeof consumeLoyaltyReward
>;
export const mockAwardLoyaltyForOrder = awardLoyaltyForOrder as MockedFunction<
  typeof awardLoyaltyForOrder
>;
export const mockResolveLoyaltyReward = resolveLoyaltyReward as MockedFunction<
  typeof resolveLoyaltyReward
>;
export const mockOrderPaymentCreateMany = prisma.orderPayment
  .createMany as MockedFunction<typeof prisma.orderPayment.createMany>;
export const mockOrderPaymentDeleteMany = prisma.orderPayment
  .deleteMany as MockedFunction<typeof prisma.orderPayment.deleteMany>;
export const mockProdUpdateMany = prisma.product.updateMany as MockedFunction<
  typeof prisma.product.updateMany
>;
export const mockOptionFindFirst = prisma.supplementOption
  .findFirst as MockedFunction<typeof prisma.supplementOption.findFirst>;
export const mockOptionUpdateMany = prisma.supplementOption
  .updateMany as MockedFunction<typeof prisma.supplementOption.updateMany>;
export const mockProdUpdate = prisma.product.update as MockedFunction<
  typeof prisma.product.update
>;
export const mockProdFindMany = prisma.product.findMany as MockedFunction<
  typeof prisma.product.findMany
>;
export const mockOptionUpdate = prisma.supplementOption
  .update as MockedFunction<typeof prisma.supplementOption.update>;
export const mockOptionFindMany = prisma.supplementOption
  .findMany as MockedFunction<typeof prisma.supplementOption.findMany>;
export const mockNotifyOrderCustomer = notifyOrderCustomer as MockedFunction<
  typeof notifyOrderCustomer
>;
export const mockSendPushToRoles = sendPushToRoles as MockedFunction<
  typeof sendPushToRoles
>;

// Deux `order.updateMany` DIFFÉRENTS cohabitent désormais dans un même flux :
//   1. la revendication du verrou de réservation (`where.stockReservedAt: null`,
//      cf. `reserveStockOnce`) ;
//   2. l'écriture de statut / paiement.
// On les discrimine sur `where.stockReservedAt` pour pouvoir simuler « stock
// déjà réservé » (claim `count: 0`) sans casser l'écriture métier.
export const isReservationClaim = (args: unknown): boolean =>
  (args as { where?: { stockReservedAt?: unknown } })?.where
    ?.stockReservedAt === null;

/** `claimCount` : 1 = verrou libre (le stock sera décrémenté), 0 = déjà réservé. */
export function mockOrderUpdateManyWithClaim(claimCount: 0 | 1): void {
  mockOrderUpdateMany.mockImplementation((async (args: unknown) =>
    isReservationClaim(args) ? { count: claimCount } : { count: 1 }) as never);
}

/** Les `order.updateMany` métier (statut / paiement), hors revendication. */
export const businessWrites = () =>
  mockOrderUpdateMany.mock.calls.filter(([args]) => !isReservationClaim(args));

export const orderWithOneItem = (
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

/** Demain, exprimé en ISO — le prédicat raisonne en jours civils Abidjan. */
export function tomorrowIso(hour = 10): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
}

/** Plus tard aujourd'hui : lointain, mais PAS un autre jour civil. */
export function laterTodayIso(): string {
  const d = new Date();
  d.setUTCHours(23, 30, 0, 0);
  return d.toISOString();
}
