import { z } from 'zod';
import { orderStatusSchema, orderTypeSchema, paymentModeSchema } from './enums';

export const updateOrderSchema = z
  .object({
    status: orderStatusSchema.optional(),
    isPaid: z.boolean().optional(),
    paymentMode: paymentModeSchema.nullable().optional(),
    driverRequested: z.boolean().optional(),
    note: z
      .string()
      .trim()
      .max(500, 'Note trop longue (max 500 caractères)')
      .nullable()
      .optional(),
  })
  .refine(
    (data) =>
      data.status !== undefined ||
      data.isPaid !== undefined ||
      data.paymentMode !== undefined ||
      data.driverRequested !== undefined ||
      data.note !== undefined,
    { message: 'Au moins un champ à mettre à jour est requis' }
  )
  .refine((data) => !(data.isPaid === true && !data.paymentMode), {
    message: 'paymentMode requis quand isPaid=true',
    path: ['paymentMode'],
  });

export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;

export const updateOrderDetailsSchema = z
  .object({
    orderType: orderTypeSchema.optional(),
    pickupTime: z
      .string()
      .datetime({ message: 'Date de retrait invalide' })
      .nullable()
      .optional(),
    paymentMode: paymentModeSchema.nullable().optional(),
    note: z
      .string()
      .trim()
      .max(500, 'Note trop longue (max 500 caractères)')
      .nullable()
      .optional(),
  })
  .refine(
    (data) =>
      data.orderType !== undefined ||
      data.pickupTime !== undefined ||
      data.paymentMode !== undefined ||
      data.note !== undefined,
    { message: 'Au moins un champ à mettre à jour est requis' }
  );

export type UpdateOrderDetailsInput = z.infer<typeof updateOrderDetailsSchema>;

export const setOrderCustomerSchema = z
  .object({
    // `null` = détacher ; chaîne non vide = lier au client existant.
    customerId: z.string().min(1).nullable().optional(),
    phone: z
      .string()
      .trim()
      .min(1, 'Téléphone requis')
      .max(30, 'Téléphone trop long (max 30 caractères)')
      .optional(),
    name: z
      .string()
      .trim()
      .max(50, 'Nom trop long (max 50 caractères)')
      .nullable()
      .optional(),
  })
  .refine((d) => d.customerId !== undefined || d.phone !== undefined, {
    message: 'customerId ou téléphone requis',
  });

export type SetOrderCustomerInput = z.infer<typeof setOrderCustomerSchema>;

export const setOrderLoyaltyRewardSchema = z.object({
  loyaltyRewardId: z.string().min(1).nullable(),
  // Retire la récompense en cadeau (produit/geste offert), sans en déduire le
  // plafond du total — ignoré si `loyaltyRewardId` est null (rien à retirer).
  redeemAsGift: z.boolean().optional(),
});

export type SetOrderLoyaltyRewardInput = z.infer<
  typeof setOrderLoyaltyRewardSchema
>;
