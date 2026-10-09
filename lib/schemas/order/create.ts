import { z } from 'zod';
import { cartItemSchema } from './cart';
import { orderTypeSchema } from './enums';

export const createOrderSchema = z.object({
  customerName: z
    .string()
    .trim()
    .min(1, 'Nom requis')
    .max(50, 'Nom trop long (max 50 caractères)')
    .nullable()
    .optional(),
  customerPhone: z
    .string()
    .trim()
    .min(1, 'Téléphone requis')
    .max(30, 'Téléphone trop long (max 30 caractères)')
    .nullable()
    .optional(),
  pickupTime: z
    .string()
    .datetime({ message: 'Date de retrait invalide' })
    .nullable()
    .optional(),
  orderDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format attendu : YYYY-MM-DD')
    .nullable()
    .optional(),
  items: z.array(cartItemSchema).min(1, 'Au moins 1 article'),
  total: z.number().int().positive('Total invalide'),
  orderType: orderTypeSchema.optional(),
  note: z
    .string()
    .trim()
    .max(500, 'Note trop longue (max 500 caractères)')
    .nullable()
    .optional(),
  loyaltyRewardId: z.string().min(1).nullable().optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

/** Antidatage et retrait sont incompatibles hors du même jour civil. */
export function isBackdateCompatibleWithPickup(d: {
  orderDate?: string | null;
  pickupTime?: string | null;
}): boolean {
  return (
    !d.orderDate || !d.pickupTime || d.pickupTime.slice(0, 10) === d.orderDate
  );
}

export const BACKDATE_PICKUP_CONFLICT_MESSAGE =
  'Une commande antidatée ne peut pas avoir un retrait un autre jour';
