// lib/orders.ts
import { z } from 'zod';
import type { OrderStatus, OrderType } from '@/generated/prisma/client';
import { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { getNextDailyNumber, todayDailyDate } from '@/lib/daily-numbering';
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

        return tx.order.create({
          data: {
            reference,
            dailyDate,
            dailyNumber,
            customerName: input.customerName,
            customerPhone: input.customerPhone,
            pickupTime: new Date(input.pickupTime),
            orderType: 'TAKEAWAY' satisfies OrderType,
            items: input.items,
            total: input.total,
          },
        });
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
  /** Filtre par jour civil (dailyDate à 00:00 local). Si omis, pas de filtre. */
  dailyDate?: Date;
}

export async function listOrders({
  page,
  status,
  dailyDate,
}: ListOrdersParams) {
  const pageSize = ORDERS_PAGE_SIZE;
  const skip = (page - 1) * pageSize;
  const where: {
    status?: OrderStatus;
    dailyDate?: Date;
  } = {};
  if (status) where.status = status;
  if (dailyDate) where.dailyDate = dailyDate;

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
