// lib/orders.ts
import { z } from 'zod';
import type { OrderStatus, OrderType } from '@/generated/prisma/client';
import { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { getNextDailyNumber, todayDailyDate } from '@/lib/daily-numbering';
import { upsertCustomerForOrder } from '@/lib/customer-mutations';
import { awardLoyaltyForOrder } from '@/lib/loyalty-mutations';
import { createOrderSchema as baseCreateOrderSchema } from '@/lib/schemas/order';
import { ORDERS_PAGE_SIZE } from '@/config/constants';

// ─── Schéma Zod : online (strict, customer obligatoire, pickupTime requis) ────

export const createOrderSchema = baseCreateOrderSchema.extend({
  customerName: z.string().trim().min(2).max(50),
  customerPhone: z.string().trim().min(8).max(20),
  pickupTime: z.string().datetime(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

// ─── Génération de référence ──────────────────────────────────────────────────

export function generateOrderReference(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
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

// ─── listOrders ───────────────────────────────────────────────────────────────

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
  /** Recherche plein texte sur référence, nom et téléphone client. */
  search?: string;
}

export type OrderFilters = Omit<ListOrdersParams, 'page'>;

/** Construit le `where` Prisma partagé entre la liste paginée et l'export. */
export function buildOrdersWhere({
  status,
  dateFrom,
  dateTo,
  search,
}: OrderFilters): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {};
  if (status) where.status = status;

  if (dateFrom || dateTo) {
    where.dailyDate = {
      ...(dateFrom ? { gte: dateFrom } : {}),
      ...(dateTo ? { lte: dateTo } : {}),
    };
  }

  const term = search?.trim();
  if (term) {
    where.OR = [
      { reference: { contains: term, mode: 'insensitive' } },
      { customerName: { contains: term, mode: 'insensitive' } },
      { customerPhone: { contains: term, mode: 'insensitive' } },
    ];
  }

  return where;
}

export async function listOrders({ page, ...filters }: ListOrdersParams) {
  const pageSize = ORDERS_PAGE_SIZE;
  const skip = (page - 1) * pageSize;
  const where = buildOrdersWhere(filters);

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
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
