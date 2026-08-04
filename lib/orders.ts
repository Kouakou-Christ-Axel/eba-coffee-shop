// lib/orders.ts
import { z } from 'zod';
import type {
  OrderStatus,
  OrderType,
  PaymentMode,
} from '@/generated/prisma/client';
import { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { getNextDailyNumber, todayDailyDate } from '@/lib/daily-numbering';
import { upsertCustomerForOrder } from '@/lib/customer-mutations';
import {
  awardLoyaltyForOrder,
  consumeLoyaltyReward,
  resolveLoyaltyReward,
} from '@/lib/loyalty-mutations';
import { getLoyaltyCard, getLoyaltyCardByPhone } from '@/lib/loyalty';
import {
  createOrderSchema as baseCreateOrderSchema,
  orderDriverFieldsSchema,
} from '@/lib/schemas/order';
import { normalizeIvorianPhone } from '@/lib/phone';
import { ROLE_GROUPS } from '@/lib/auth-helpers';
import { sendPushToRoles } from '@/lib/push-notify';
import { getPickupCode } from '@/lib/orders/format';
import { parseOrderSearchTerm } from '@/lib/orders/search';
import {
  fetchStockSnapshot,
  computeOrderItemsAvailability,
} from '@/lib/orders/availability';
import { ORDERS_PAGE_SIZE, PHONE_SEARCH_MIN_DIGITS } from '@/config/constants';
import type { CartItem } from '@/lib/cart-store';

// ─── Schéma Zod : online (strict, customer obligatoire) ──────────────────────
//
// `pickupTime` est optionnel : absent/null = « dès que possible » (traité comme
// un walk-in : préparation immédiate, pas de rendez-vous — le mode par défaut,
// aligné sur le processus réel du comptoir). Une valeur = retrait planifié.
//
// `orderType` en ligne : `TAKEAWAY` (le client vient) ou `DELIVERY` (il envoie
// SON livreur — la cuisine voit alors le bouton « demander le livreur »).
// Jamais `DINE_IN` depuis le site.
//
// Le bloc livreur est optionnel au checkout (le client peut ne pas encore le
// connaître) ; il reste modifiable ensuite depuis la page de suivi.

export const createOrderSchema = baseCreateOrderSchema
  .extend({
    customerName: z.string().trim().min(2).max(50),
    customerPhone: z.string().trim().min(8).max(20),
    pickupTime: z.string().datetime().nullable().optional(),
    orderType: z.enum(['TAKEAWAY', 'DELIVERY']).optional(),
  })
  .extend(orderDriverFieldsSchema.partial().shape)
  .refine(
    (d) =>
      ((d.driverName ?? null) === null) === ((d.driverPhone ?? null) === null),
    {
      message: 'Nom et téléphone du livreur vont ensemble',
      path: ['driverPhone'],
    }
  );

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

// ─── Génération de référence ──────────────────────────────────────────────────

export function generateOrderReference(date: Date = new Date()): string {
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const suffix = Array.from(
    { length: 4 },
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join('');
  return `EBA-${dateStr}-${suffix}`;
}

// ─── createOrder (public, online) ─────────────────────────────────────────────

const MAX_DAILY_NUMBER_RETRIES = 3;

export async function createOrder(input: CreateOrderInput) {
  const dailyDate = todayDailyDate();

  for (let attempt = 0; attempt < MAX_DAILY_NUMBER_RETRIES; attempt++) {
    try {
      const created = await prisma.$transaction(async (tx) => {
        const dailyNumber = await getNextDailyNumber(tx, dailyDate);
        const reference = generateOrderReference();
        const customerId = await upsertCustomerForOrder(
          tx,
          input.customerPhone,
          input.customerName
        );

        const driverPhone = input.driverPhone
          ? (normalizeIvorianPhone(input.driverPhone) ?? input.driverPhone)
          : null;

        // Récompense fidélité (carte à tampons) auto-appliquée au checkout :
        // mêmes règles que la caisse (lib/order-mutations.ts) — vérifiée
        // contre le client résolu du MÊME téléphone que la commande, remise
        // plafonnée (jamais plus que le total), consommée dans la MÊME
        // transaction, tampon calculé sur le total NET. Revérifiée à chaque
        // tentative de retry (une transaction annulée n'a rien écrit).
        // `input.total` est le total BRUT envoyé par le client ; lève
        // LoyaltyRewardUnavailableError (→ 400) si la récompense a été
        // consommée entre-temps (ex. au comptoir).
        let reward: { id: string; capAmount: number } | null = null;
        if (input.loyaltyRewardId) {
          reward = await resolveLoyaltyReward(
            tx,
            input.loyaltyRewardId,
            customerId
          );
        }
        const discount = reward ? Math.min(reward.capAmount, input.total) : 0;

        const order = await tx.order.create({
          data: {
            reference,
            dailyDate,
            dailyNumber,
            customerName: input.customerName,
            customerPhone: input.customerPhone,
            customerId,
            pickupTime: input.pickupTime ? new Date(input.pickupTime) : null,
            orderType: (input.orderType ?? 'TAKEAWAY') satisfies OrderType,
            items: input.items,
            total: input.total - discount,
            note: input.note ?? null,
            driverName: input.driverName ?? null,
            driverPhone,
            loyaltyRewardId: reward?.id ?? null,
            loyaltyDiscount: discount || null,
          },
        });

        if (reward) {
          await consumeLoyaltyReward(tx, {
            rewardId: reward.id,
            customerId: customerId as string,
            orderId: order.id,
            capAmount: reward.capAmount,
            actorId: null,
          });
        }

        if (customerId) {
          await awardLoyaltyForOrder(tx, {
            customerId,
            orderId: order.id,
            orderTotal: order.total,
            actorId: null,
          });
        }

        return order;
      });

      // Push staff (best-effort, jamais bloquant) : les commandes EN LIGNE
      // arrivent sans personne devant l'écran caisse — c'est le cas qui
      // justifie la notification (le walk-in est notifié par
      // createCashierOrder, lib/order-mutations.ts).
      sendPushToRoles(ROLE_GROUPS.DASHBOARD, {
        title: 'Nouvelle commande en ligne',
        body:
          `#${String(created.dailyNumber).padStart(3, '0')} · ${getPickupCode(created.reference)}` +
          ` · ${created.total} FCFA` +
          `${created.customerName ? ` · ${created.customerName}` : ''}` +
          `${created.orderType === 'DELIVERY' ? ' · livreur client' : ''}`,
        url: '/dashboard/caisse',
        tag: `order-${created.id}`,
      }).catch((err) => {
        console.error('[orders] notification push échouée :', err);
      });

      return created;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002' &&
        attempt < MAX_DAILY_NUMBER_RETRIES - 1
      ) {
        continue;
      }
      throw err;
    }
  }

  throw new Error('Impossible de générer un numéro de commande quotidien');
}

export async function getOrder(id: string) {
  // `payments` : détail des lignes de paiement fractionné (affiché quand
  // `paymentMode` est null malgré `isPaid=true` — cf. page de détail admin).
  return prisma.order.findUnique({
    where: { id },
    include: { payments: true },
  });
}

// ─── Vue publique (page de suivi /commande/:id) ───────────────────────────────
//
// Sous-ensemble sûr d'une commande, exposé sans authentification : l'`id` cuid
// non devinable sert de capability URL (page noindex). Dates sérialisées en ISO
// pour transiter telles quelles entre route handler, server component et
// composant client de polling.

/** Article de commande enrichi de sa disponibilité courante (voir plus bas). */
export type PublicOrderItemView = CartItem & { available: boolean };

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
  paymentProofUrl: string | null;
  customerName: string | null;
  pickupTime: string | null;
  items: PublicOrderItemView[];
  /** Faux si au moins un article n'est plus disponible au stock actuel — voir
   * `available` par article. Toujours vrai une fois la commande payée (stock
   * déjà réservé pour ce client au paiement). */
  fulfillable: boolean;
  /** Montant de la récompense fidélité déjà déduit de `total` (F CFA), null
   * si aucune récompense n'a été appliquée à cette commande. */
  loyaltyDiscount: number | null;
  total: number;
  note: string | null;
  driverName: string | null;
  driverPhone: string | null;
  createdAt: string;
  /** Null si le programme est désactivé ou si le client n'a pas pu être
   * identifié (pas de téléphone exploitable) — toujours résolu par
   * téléphone (clé unique de `Customer`), jamais par le nom. */
  loyalty: PublicOrderLoyaltyView | null;
};

/**
 * `available`/`fulfillable` : uniquement pertinents pour une commande NON
 * PAYÉE — comparaison au stock ACTUEL (produit + options choisies) pour
 * signaler, avant tentative de paiement, qu'un article n'est plus disponible
 * (page de suivi client, polling). Une commande déjà payée a réservé son
 * stock : tout est `available: true` sans requête supplémentaire.
 */
export async function getPublicOrder(
  id: string
): Promise<PublicOrderView | null> {
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return null;

  const items = order.items as unknown as CartItem[];

  let itemsView: PublicOrderItemView[];
  let fulfillable: boolean;
  if (order.isPaid) {
    itemsView = items.map((item) => ({ ...item, available: true }));
    fulfillable = true;
  } else {
    const stock = await fetchStockSnapshot([items]);
    const availability = computeOrderItemsAvailability(items, stock);
    const availableByCartId = new Map(
      availability.items.map((a) => [a.cartId, a.available])
    );
    itemsView = items.map((item) => ({
      ...item,
      available: availableByCartId.get(item.cartId) ?? true,
    }));
    fulfillable = availability.fulfillable;
  }

  const loyalty = await getPublicOrderLoyalty(order);

  return {
    id: order.id,
    reference: order.reference,
    dailyNumber: order.dailyNumber,
    status: order.status,
    orderType: order.orderType,
    isPaid: order.isPaid,
    paymentProofUrl: order.paymentProofUrl,
    customerName: order.customerName,
    pickupTime: order.pickupTime?.toISOString() ?? null,
    items: itemsView,
    fulfillable,
    loyaltyDiscount: order.loyaltyDiscount,
    total: order.total,
    note: order.note,
    driverName: order.driverName,
    driverPhone: order.driverPhone,
    createdAt: order.createdAt.toISOString(),
    loyalty,
  };
}

/**
 * Résout la carte fidélité du client d'une commande — toujours via
 * `customerId` (client déjà rattaché) ou, à défaut, via `customerPhone`
 * (clé unique de `Customer`, jamais le nom). `null` si le programme est
 * désactivé ou si aucun client n'a pu être identifié.
 */
async function getPublicOrderLoyalty(order: {
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
    where: { customerId: card.customer.id },
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

// ─── listOrders ───────────────────────────────────────────────────────────────

/** Filtre paiement : `unpaid` (non encaissée) ou un mode précis. */
export type PaymentFilter = 'unpaid' | PaymentMode;

/** Tri de la liste des commandes (list-only, hors export). */
export type OrderSort =
  | 'recent'
  | 'oldest'
  | 'total_desc'
  | 'total_asc'
  | 'number';

export interface ListOrdersParams {
  page: number;
  status?: OrderStatus;
  /**
   * Filtre par plage de jours civils (dailyDate à 00:00 local, inclusif).
   * Si `dateFrom`/`dateTo` sont omis, pas de filtre de date. Un jour unique
   * correspond à `dateFrom === dateTo`.
   */
  dateFrom?: Date;
  dateTo?: Date;
  /** Recherche plein texte sur référence, nom, téléphone et n° du jour. */
  search?: string;
  /** Filtre par état/moyen de paiement. */
  payment?: PaymentFilter;
  /** Ordre de tri (défaut : `recent`). */
  sort?: OrderSort;
}

/** Filtres partagés liste + export (le tri reste propre à la liste). */
export type OrderFilters = Omit<ListOrdersParams, 'page' | 'sort'>;

/** Construit le `where` Prisma partagé entre la liste paginée et l'export. */
export function buildOrdersWhere({
  status,
  dateFrom,
  dateTo,
  search,
  payment,
}: OrderFilters): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {};
  if (status) where.status = status;

  if (payment === 'unpaid') {
    where.isPaid = false;
  } else if (payment) {
    where.isPaid = true;
    where.paymentMode = payment;
  }

  if (dateFrom || dateTo) {
    where.dailyDate = {
      ...(dateFrom ? { gte: dateFrom } : {}),
      ...(dateTo ? { lte: dateTo } : {}),
    };
  }

  // Parsing mutualisé avec la recherche caisse (`lib/orders/search.ts`). Un
  // `where` Prisma ne peut pas appeler un prédicat JS : seul le TERME PARSÉ est
  // partagé, les clauses SQL restent propres à cette liste.
  const parsed = search ? parseOrderSearchTerm(search) : null;
  if (parsed) {
    const or: Prisma.OrderWhereInput[] = [
      { reference: { contains: parsed.raw, mode: 'insensitive' } },
      { customerName: { contains: parsed.raw, mode: 'insensitive' } },
    ];
    // Téléphone : on compare les CHIFFRES BRUTS du terme, pas le terme brut.
    // « 07 88 12 » ne matchait rien contre un « +22507881234567 » stocké.
    if (parsed.digits.length >= PHONE_SEARCH_MIN_DIGITS) {
      or.push({ customerPhone: { contains: parsed.digits } });
    }
    // Terme purement numérique → match exact du n° du jour (#003 → 3).
    if (parsed.dailyNumber !== null) {
      or.push({ dailyNumber: parsed.dailyNumber });
    }
    where.OR = or;
  }

  return where;
}

/** Mappe un tri vers la clause `orderBy` Prisma correspondante. */
const ORDER_BY: Record<
  OrderSort,
  Prisma.OrderOrderByWithRelationInput | Prisma.OrderOrderByWithRelationInput[]
> = {
  recent: { createdAt: 'desc' },
  oldest: { createdAt: 'asc' },
  total_desc: { total: 'desc' },
  total_asc: { total: 'asc' },
  // dailyNumber repart à 1 chaque jour → trier d'abord par jour.
  number: [{ dailyDate: 'desc' }, { dailyNumber: 'desc' }],
};

export async function listOrders({ page, sort, ...filters }: ListOrdersParams) {
  const pageSize = ORDERS_PAGE_SIZE;
  const skip = (page - 1) * pageSize;
  const where = buildOrdersWhere(filters);

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: ORDER_BY[sort ?? 'recent'],
      skip,
      take: pageSize,
    }),
    prisma.order.count({ where }),
  ]);

  return { orders, total, pageSize };
}

/**
 * Récupère toutes les commandes correspondant aux filtres (sans pagination),
 * pour l'export CSV. Triées par date de création croissante (ordre chronologique
 * naturel pour un tableur).
 */
export async function getOrdersForExport(filters: OrderFilters) {
  return prisma.order.findMany({
    where: buildOrdersWhere(filters),
    orderBy: { createdAt: 'asc' },
  });
}
