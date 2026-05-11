// lib/orders.ts
import { z } from 'zod';
import type { OrderStatus } from '@/generated/prisma';
import prisma from '@/lib/prisma';

// ─── Schémas Zod ──────────────────────────────────────────────────────────────

const cartItemSupplementSchema = z.object({
  groupName: z.string(),
  optionName: z.string(),
  price: z.number().int().nonnegative(),
});

const cartItemSchema = z.object({
  cartId: z.string(),
  productId: z.string(),
  productName: z.string(),
  basePrice: z.number().int().nonnegative(),
  quantity: z.number().int().positive(),
  supplements: z.array(cartItemSupplementSchema),
});

export const createOrderSchema = z.object({
  customerName: z.string().min(2).max(50),
  customerPhone: z.string().min(8).max(20),
  pickupTime: z.string().datetime(),
  items: z.array(cartItemSchema).min(1),
  total: z.number().int().positive(),
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

// ─── Opérations DB ────────────────────────────────────────────────────────────

export async function createOrder(input: CreateOrderInput) {
  const reference = generateOrderReference();

  return prisma.order.create({
    data: {
      reference,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      pickupTime: new Date(input.pickupTime),
      items: input.items,
      total: input.total,
    },
  });
}

export async function getOrder(id: string) {
  return prisma.order.findUnique({ where: { id } });
}

// ─── listOrders ───────────────────────────────────────────────────────────────

export interface ListOrdersParams {
  page: number;
  status?: OrderStatus;
}

export async function listOrders({ page, status }: ListOrdersParams) {
  const pageSize = 20;
  const skip = (page - 1) * pageSize;
  const where = status ? { status } : {};

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
