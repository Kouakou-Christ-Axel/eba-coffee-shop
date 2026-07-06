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
import { awardLoyaltyForOrder } from '@/lib/loyalty-mutations';
import {
  createOrderSchema as baseCreateOrderSchema,
  orderDriverFieldsSchema,
} from '@/lib/schemas/order';
import { normalizeIvorianPhone } from '@/lib/phone';
import { ORDERS_PAGE_SIZE } from '@/config/constants';
import type { CartItem } from '@/lib/cart-store';

// ─── Schéma Zod : online (strict, customer obligatoire, pickupTime requis) ────
//
// Le bloc livreur est optionnel au checkout (le client peut ne pas encore le
// connaître) ; il reste modifiable ensuite depuis la page de suivi.

export const createOrderSchema = baseCreateOrderSchema
  .extend({
    customerName: z.string().trim().min(2).max(50),
    customerPhone: z.string().trim().min(8).max(20),
    pickupTime: z.string().datetime(),
  })
  .extend(orderDriverFieldsSchema.partial().shape)
  .refine(
    (d) => ((d.driverName ?? null) === null) === ((d.driverPhone ?? null) === null),
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
// Toujours TAKEAWAY pour les commandes online (cf. plan).

const MAX_DAILY_NUMBER_RETRIES = 3;

export async function createOrder(input: CreateOrderInput) {
  const dailyDate = todayDailyDate();

  for (let attempt = 0; attempt < MAX_DAILY_NUMBER_RETRIES; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
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

        const order = await tx.order.create({
          data: {
            reference,
            dailyDate,
            dailyNumber,
            customerName: input.customerName,
            customerPhone: input.customerPhone,
            customerId,
            pickupTime: new Date(input.pickupTime),
            orderType: 'TAKEAWAY' satisfies OrderType,
            items: input.items,
            total: input.total,
            note: input.note ?? null,
            driverName: input.driverName ?? null,
            driverPhone,
          },
        });

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
  return prisma.order.findUnique({ where: { id } });
}

// ─── Vue publique (page de suivi /commande/:id) ───────────────────────────────
//
// Sous-ensemble sûr d'une commande, exposé sans authentification : l'`id` cuid
// non devinable sert de capability URL (page noindex). Dates sérialisées en ISO
// pour transiter telles quelles entre route handler, server component et
// composant client de polling.

export type PublicOrderView = {
  id: string;
  reference: string;
  status: OrderStatus;
  orderType: OrderType;
  isPaid: boolean;
  paymentProofUrl: string | null;
  customerName: string | null;
  pickupTime: string | null;
  items: CartItem[];
  total: number;
  note: string | null;
  driverName: string | null;
  driverPhone: string | null;
  createdAt: string;
};

export async function getPublicOrder(
  id: string
): Promise<PublicOrderView | null> {
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return null;
  return {
    id: order.id,
    reference: order.reference,
    status: order.status,
    orderType: order.orderType,
    isPaid: order.isPaid,
    paymentProofUrl: order.paymentProofUrl,
    customerName: order.customerName,
    pickupTime: order.pickupTime?.toISOString() ?? null,
    items: order.items as unknown as CartItem[],
    total: order.total,
    note: order.note,
    driverName: order.driverName,
    driverPhone: order.driverPhone,
    createdAt: order.createdAt.toISOString(),
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

  const term = search?.trim();
  if (term) {
    const or: Prisma.OrderWhereInput[] = [
      { reference: { contains: term, mode: 'insensitive' } },
      { customerName: { contains: term, mode: 'insensitive' } },
      { customerPhone: { contains: term, mode: 'insensitive' } },
    ];
    // Terme purement numérique → match exact du n° du jour (#003 → 3).
    if (/^\d+$/.test(term)) {
      const n = Number(term);
      if (Number.isSafeInteger(n) && n > 0 && n <= 2_147_483_647) {
        or.push({ dailyNumber: n });
      }
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
