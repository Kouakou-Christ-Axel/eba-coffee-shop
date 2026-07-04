// lib/schemas/order.ts
//
// Schémas Zod centralisés pour la création et la mise à jour des commandes.
// Source : extraction des schémas dupliqués entre lib/orders.ts et
// app/api/caisse/orders/route.ts + variantes PATCH (status, payment,
// driver-request).
//
// Les messages d'erreur restent en français (cible Côte d'Ivoire).

import { z } from 'zod';
import {
  MAX_LINE_DISCOUNT_RATIO,
  ORDER_DISCOUNT_REASON_MAX,
} from '@/config/constants';

// ─── Sous-schémas : articles du panier ────────────────────────────────────────

export const cartItemSupplementSchema = z.object({
  groupName: z.string(),
  optionName: z.string(),
  price: z.number().int().nonnegative(),
  // Nombre de fois où cette option est choisie (groupe type 'quantity', ex.
  // 2x « Vanille »). Absent/1 pour les choix 'single'/'multiple' classiques.
  quantity: z.number().int().positive().optional().default(1),
});

export const cartItemSchema = z
  .object({
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
    // Remise (montant fixe FCFA) appliquée à la ligne, motif optionnel.
    discount: z.number().int().nonnegative().optional().default(0),
    discountReason: z
      .string()
      .trim()
      .max(ORDER_DISCOUNT_REASON_MAX, 'Motif trop long')
      .nullable()
      .optional(),
  })
  // La remise d'une ligne ne peut pas dépasser le plafond métier.
  .refine(
    (it) => {
      const supplementsTotal = it.supplements.reduce(
        (s, x) => s + x.price * x.quantity,
        0
      );
      const gross = (it.basePrice + supplementsTotal) * it.quantity;
      return (it.discount ?? 0) <= Math.floor(gross * MAX_LINE_DISCOUNT_RATIO);
    },
    {
      message: `Remise trop élevée (max ${Math.round(MAX_LINE_DISCOUNT_RATIO * 100)}% de la ligne)`,
      path: ['discount'],
    }
  );

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
  // Antidatage : jour civil (Abidjan) auquel rattacher la commande, format
  // YYYY-MM-DD. Absent = jour en cours. Utilisé par la caisse et l'outil MCP
  // pour enregistrer des commandes anciennes ; ignoré par le flux online.
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

// ─── updateOrderDetailsSchema ─────────────────────────────────────────────────
//
// Édition « administrative » des métadonnées d'une commande existante, réservée
// à l'ADMIN (cf. requireAdmin dans la server action / le garde-fou MCP) :
//   - moyen de paiement (paymentMode)
//   - type de commande (orderType)
//   - date & heure de récupération (pickupTime)
//   - note
//
// Distinct de `updateOrderSchema` (statut / encaissement / livreur) : ici on ne
// touche ni au statut ni à `isPaid`, uniquement à ces champs descriptifs. Mise à
// jour partielle : seuls les champs fournis sont modifiés.

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

// ─── setOrderCustomerSchema ───────────────────────────────────────────────────
//
// Association (a posteriori) d'une commande existante à un client (CRM). Trois
// usages couverts par un seul schéma :
//   - lier à un client existant      → { customerId: "<id>" }
//   - lier via téléphone (upsert)    → { phone: "07…", name?: "…" }
//   - détacher (rendre anonyme)      → { customerId: null }
//
// La logique de résolution (priorité customerId > phone, upsert, fidélité) vit
// dans `setOrderCustomer` (lib/order-mutations.ts).

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
