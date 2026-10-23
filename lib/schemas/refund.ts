// lib/schemas/refund.ts
//
// Schémas Zod des remboursements (source unique : actions, routes, MCP).

import { z } from 'zod';
import {
  REFUND_AMOUNT_MAX,
  REFUND_LINES_MAX,
  REFUND_NOTE_MAX,
} from '@/config/constants';
import { SELECTABLE_PAYMENT_MODES } from '@/lib/payment-modes';

// Miroirs des enums Prisma (test de dérive : lib/schemas/refund.test.ts).
export const REFUND_STATUSES = [
  'REQUESTED',
  'APPROVED',
  'PROCESSING',
  'UNCERTAIN',
  'FAILED',
  'PAID',
  'REJECTED',
  'CANCELLED',
] as const;
export const REFUND_DELIVERIES = [
  'JEKO_TRANSFER',
  'MANUAL',
  'STORE_CREDIT',
] as const;
export const REFUND_REASONS = [
  'PRODUCT_UNAVAILABLE',
  'QUALITY',
  'PRICE_ERROR',
  'DOUBLE_PAYMENT',
  'CUSTOMER_CHANGED_MIND',
  'LATE_PAYMENT',
  'COMMERCIAL_GESTURE',
  'OTHER',
] as const;
export const REFUND_SOURCES = ['STAFF', 'AUTO_LATE'] as const;
export const REFUND_LINE_KINDS = ['PRODUCT', 'SUPPLEMENT'] as const;

export type RefundStatusValue = (typeof REFUND_STATUSES)[number];

/** Comptent dans le plafond remboursable (tout sauf refusé / annulé). */
export const ACTIVE_REFUND_STATUSES: RefundStatusValue[] = [
  'REQUESTED',
  'APPROVED',
  'PROCESSING',
  'UNCERTAIN',
  'FAILED',
  'PAID',
];

export const REFUND_REASON_LABELS: Record<
  (typeof REFUND_REASONS)[number],
  string
> = {
  PRODUCT_UNAVAILABLE: 'Produit indisponible',
  QUALITY: 'Problème de qualité',
  PRICE_ERROR: 'Erreur de prix',
  DOUBLE_PAYMENT: 'Double paiement',
  CUSTOMER_CHANGED_MIND: 'Le client a changé d’avis',
  LATE_PAYMENT: 'Paiement tardif',
  COMMERCIAL_GESTURE: 'Geste commercial',
  OTHER: 'Autre',
};

const noteSchema = z.string().trim().max(REFUND_NOTE_MAX);

export const refundLineSchema = z.object({
  cartId: z.string().min(1).max(64),
  productId: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(200),
  kind: z.enum(REFUND_LINE_KINDS),
  groupName: z.string().trim().max(200).optional(),
  optionName: z.string().trim().max(200).optional(),
  quantity: z.number().int().positive().max(1000),
  amount: z.number().int().min(0).max(REFUND_AMOUNT_MAX),
});

export const createRefundSchema = z.object({
  orderId: z.string().min(1),
  amount: z.number().int().positive().max(REFUND_AMOUNT_MAX),
  reason: z.enum(REFUND_REASONS),
  note: noteSchema.optional(),
  /** Canal de sortie ; défaut : le mode utilisé par le client. */
  channel: z.enum(SELECTABLE_PAYMENT_MODES).optional(),
  delivery: z.enum(REFUND_DELIVERIES).optional(),
  /** Défaut : le numéro de la commande. */
  destinationPhone: z.string().trim().max(32).optional(),
  /** Remettre en stock les lignes remboursées (exige des lignes). */
  restockItems: z.boolean().default(false),
  lines: z.array(refundLineSchema).max(REFUND_LINES_MAX).default([]),
});
export type CreateRefundInput = z.infer<typeof createRefundSchema>;
export type RefundLineInput = z.infer<typeof refundLineSchema>;

export const updateRefundDestinationSchema = z
  .object({
    id: z.string().min(1),
    channel: z.enum(SELECTABLE_PAYMENT_MODES).optional(),
    delivery: z.enum(REFUND_DELIVERIES).optional(),
    destinationPhone: z.string().trim().max(32).optional(),
    note: noteSchema.optional(),
  })
  .refine(
    (v) =>
      v.channel !== undefined ||
      v.delivery !== undefined ||
      v.destinationPhone !== undefined,
    { message: 'Rien à modifier' }
  );
export type UpdateRefundDestinationInput = z.infer<
  typeof updateRefundDestinationSchema
>;

/** Conversion d'un avoir (remboursement `STORE_CREDIT` payé) en argent rendu. */
export const convertCreditSchema = z.object({
  sourceRefundId: z.string().min(1),
  amount: z.number().int().positive().max(REFUND_AMOUNT_MAX),
  channel: z.enum(SELECTABLE_PAYMENT_MODES),
  delivery: z.enum(['JEKO_TRANSFER', 'MANUAL']),
  destinationPhone: z.string().trim().max(32).optional(),
  note: noteSchema.optional(),
});
export type ConvertCreditInput = z.infer<typeof convertCreditSchema>;

export const refundNoteSchema = z.object({
  id: z.string().min(1),
  note: noteSchema.optional(),
});

export const resolveUncertainSchema = z.object({
  id: z.string().min(1),
  /** SENT : l'argent est bien parti (vérifié chez Jèko). NOT_SENT : rien n'est parti. */
  outcome: z.enum(['SENT', 'NOT_SENT']),
  note: noteSchema.optional(),
});
