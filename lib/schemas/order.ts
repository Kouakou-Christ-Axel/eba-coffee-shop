// lib/schemas/order.ts
//
// Schémas Zod centralisés pour la création et la mise à jour des commandes.
// Source : extraction des schémas dupliqués entre lib/orders.ts et
// app/api/caisse/orders/route.ts + variantes PATCH (status, payment,
// driver-request).
//
// Les messages d'erreur restent en français (cible Côte d'Ivoire).

import { z } from 'zod';

// ─── Sous-schémas : articles du panier ────────────────────────────────────────

export const cartItemSupplementSchema = z.object({
  groupName: z.string(),
  optionName: z.string(),
  price: z.number().int().nonnegative(),
});

export const cartItemSchema = z.object({
  cartId: z.string(),
  productId: z.string(),
  productName: z.string(),
  basePrice: z.number().int().nonnegative(),
  coutMatiere: z.number().int().nonnegative().default(0),
  coutEmballage: z.number().int().nonnegative().default(0),
  quantity: z.number().int().positive(),
  supplements: z.array(cartItemSupplementSchema),
  // Marque une ligne ajoutée après la création de la commande.
  addedLater: z.boolean().optional().default(false),
});

export type CartItemSupplementInput = z.infer<typeof cartItemSupplementSchema>;
export type CartItemInput = z.infer<typeof cartItemSchema>;

// ─── Énumérations partagées ──────────────────────────────────────────────────

export const orderStatusSchema = z.enum([
  'NEW',
  'PREPARING',
  'READY',
  'COMPLETED',
  'CANCELLED',
]);

export const orderTypeSchema = z.enum(['DELIVERY', 'DINE_IN', 'TAKEAWAY']);

export const paymentModeSchema = z.enum(['CASH', 'WAVE', 'OTHER']);

export type OrderStatusInput = z.infer<typeof orderStatusSchema>;
export type OrderTypeInput = z.infer<typeof orderTypeSchema>;
export type PaymentModeInput = z.infer<typeof paymentModeSchema>;

// ─── createOrderSchema ────────────────────────────────────────────────────────
//
// Version unifiée couvrant :
//   - commandes online (lib/orders.ts : customerName/Phone obligatoires,
//     pickupTime obligatoire, orderType toujours TAKEAWAY)
//   - commandes walk-in caisse (app/api/caisse/orders/route.ts :
//     customerName/Phone optionnels, orderType libre, note possible,
//     pas de pickupTime)
//
// On garde tous les champs des deux sources ; les routes resteront responsables
// de leurs propres règles métier (ex. forcer orderType=TAKEAWAY côté online).

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
  items: z.array(cartItemSchema).min(1, 'Au moins 1 article'),
  total: z.number().int().positive('Total invalide'),
  orderType: orderTypeSchema.optional(),
  note: z
    .string()
    .trim()
    .max(500, 'Note trop longue (max 500 caractères)')
    .nullable()
    .optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

// ─── updateOrderSchema ────────────────────────────────────────────────────────
//
// Aggrège les trois variantes PATCH existantes :
//   - PATCH /api/caisse/orders/:id/status         { status }
//   - PATCH /api/caisse/orders/:id/payment        { isPaid, paymentMode? }
//   - PATCH /api/caisse/orders/:id/driver-request { requested }
//
// Tous les champs sont optionnels (mise à jour partielle). Les règles
// inter-champs (paymentMode obligatoire si isPaid=true, transitions de statut,
// permissions) restent appliquées par les routes concernées.

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
