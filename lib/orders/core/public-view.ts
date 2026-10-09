import { withStaffVisible } from '@/lib/orders/visibility';
import type { OrderStatus, OrderType } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { getLoyaltyCard, getLoyaltyCardByPhone } from '@/lib/loyalty';
import {
  fetchStockSnapshot,
  computeOrderItemsAvailability,
} from '@/lib/orders/availability';
import { isDeferredPickup } from '@/lib/orders/scheduling';
import { getPaymentView, type PaymentView } from '@/lib/orders/payment-view';
import type { CartItem } from '@/lib/cart-store';

export async function getOrder(id: string) {
  // `payments` : détail des lignes de paiement fractionné (affiché quand
  // `paymentMode` est null malgré `isPaid=true` — cf. page de détail admin).
  return prisma.order.findUnique({
    where: { id },
    include: { payments: true },
  });
}

/** Article de commande enrichi de sa disponibilité courante (voir plus bas). */
export type PublicOrderItemView = CartItem & {
  available: boolean;
  missingProduct?: boolean;
  missingOptionNames?: string[];
};

/** Avancement de la carte fidélité du client, pour la page de suivi. */
export type PublicOrderLoyaltyView = {
  stampCount: number;
  stampsPerCard: number;
  tier1Stamps: number;
  tier1RewardCap: number;
  tier2RewardCap: number;
  minOrderAmount: number;
  availableRewardsCount: number;
  /** Vrai si c'est la seule commande (à ce jour) rattachée à ce client. */
  isFirstOrder: boolean;
};

export type PublicOrderView = {
  id: string;
  reference: string;
  dailyNumber: number;
  status: OrderStatus;
  orderType: OrderType;
  isPaid: boolean;
  payment: PaymentView;
  customerName: string | null;
  pickupTime: string | null;
  items: PublicOrderItemView[];
  fulfillable: boolean;
  loyaltyDiscount: number | null;
  total: number;
  depositRequired: number | null;
  depositPaid: number | null;
  note: string | null;
  driverName: string | null;
  driverPhone: string | null;
  createdAt: string;
  loyalty: PublicOrderLoyaltyView | null;
};

export async function getPublicOrder(
  id: string
): Promise<PublicOrderView | null> {
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return null;

  const items = order.items as unknown as CartItem[];

  let itemsView: PublicOrderItemView[];
  let fulfillable: boolean;
  if (order.stockReservedAt || isDeferredPickup(order.pickupTime)) {
    itemsView = items.map((item) => ({ ...item, available: true }));
    fulfillable = true;
  } else {
    const stock = await fetchStockSnapshot([items]);
    const availability = computeOrderItemsAvailability(items, stock);
    const byCartId = new Map(availability.items.map((a) => [a.cartId, a]));
    itemsView = items.map((item) => {
      const a = byCartId.get(item.cartId);
      return a && !a.available
        ? {
            ...item,
            available: false,
            missingProduct: a.missingProduct,
            missingOptionNames: a.missingOptionNames,
          }
        : { ...item, available: true };
    });
    fulfillable = availability.fulfillable;
  }

  const loyalty = await getPublicOrderLoyalty(order);
  const payment = getPaymentView(order);

  return {
    id: order.id,
    reference: order.reference,
    dailyNumber: order.dailyNumber,
    status: order.status,
    orderType: order.orderType,
    isPaid: order.isPaid,
    payment,
    customerName: order.customerName,
    pickupTime: order.pickupTime?.toISOString() ?? null,
    items: itemsView,
    fulfillable,
    loyaltyDiscount: order.loyaltyDiscount,
    total: order.total,
    depositRequired: order.depositRequired,
    depositPaid: order.depositPaid,
    note: order.note,
    driverName: order.driverName,
    driverPhone: order.driverPhone,
    createdAt: order.createdAt.toISOString(),
    loyalty,
  };
}

export async function getPublicOrderLoyalty(order: {
  customerId: string | null;
  customerPhone: string | null;
}): Promise<PublicOrderLoyaltyView | null> {
  const card = order.customerId
    ? await getLoyaltyCard(order.customerId)
    : order.customerPhone
      ? await getLoyaltyCardByPhone(order.customerPhone)
      : null;
  if (!card || !card.settings.enabled) return null;

  const ordersCount = await prisma.order.count({
    where: withStaffVisible({ customerId: card.customer.id }),
  });

  return {
    stampCount: card.stampCount,
    stampsPerCard: card.settings.stampsPerCard,
    tier1Stamps: card.settings.tier1Stamps,
    tier1RewardCap: card.settings.tier1RewardCap,
    tier2RewardCap: card.settings.tier2RewardCap,
    minOrderAmount: card.settings.minOrderAmount,
    availableRewardsCount: card.availableRewards.length,
    isFirstOrder: ordersCount <= 1,
  };
}
