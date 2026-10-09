import { z } from 'zod';
import {
  ORDER_CUSTOMER_NAME_MAX,
  ORDER_CUSTOMER_PHONE_MAX,
  ORDER_NOTE_MAX,
} from '@/config/constants';
import { orderTypeSchema } from './enums';

export const orderDriverFieldsSchema = z.object({
  driverName: z
    .string()
    .trim()
    .min(2, 'Nom du livreur requis (min 2 caractères)')
    .max(ORDER_CUSTOMER_NAME_MAX, 'Nom trop long (max 50 caractères)')
    .nullable(),
  driverPhone: z
    .string()
    .trim()
    .min(8, 'Numéro du livreur requis (min 8 chiffres)')
    .max(ORDER_CUSTOMER_PHONE_MAX, 'Téléphone trop long (max 30 caractères)')
    .nullable(),
});

export const updateOrderFulfillmentSchema = z
  .object({
    orderType: orderTypeSchema.optional(),
    pickupTime: z
      .string()
      .datetime({ message: 'Date de retrait invalide' })
      .nullable()
      .optional(),
    driverName: orderDriverFieldsSchema.shape.driverName.optional(),
    driverPhone: orderDriverFieldsSchema.shape.driverPhone.optional(),
    note: z
      .string()
      .trim()
      .max(ORDER_NOTE_MAX, 'Note trop longue')
      .nullable()
      .optional(),
  })
  .refine(
    (d) =>
      d.orderType !== undefined ||
      d.pickupTime !== undefined ||
      d.driverName !== undefined ||
      d.driverPhone !== undefined ||
      d.note !== undefined,
    { message: 'Au moins un champ à mettre à jour est requis' }
  );

export type UpdateOrderFulfillmentInput = z.infer<
  typeof updateOrderFulfillmentSchema
>;
