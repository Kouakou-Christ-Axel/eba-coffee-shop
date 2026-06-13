// lib/schemas/revenue-adjustment.ts
//
// Schémas Zod centralisés pour les régularisations de recette (ajustement manuel
// du CA, sans commande). Réutilisés par les server actions du dashboard, la route
// d'export et le serveur MCP. Conformément à CLAUDE.md : pas de redéclaration
// inline ailleurs.

import { z } from 'zod';
import {
  REVENUE_ADJUSTMENT_NOTE_MAX,
  REVENUE_ADJUSTMENT_AMOUNT_MAX,
} from '@/config/constants';

// Réutilise l'enum métier PaymentMode (cohérent avec les commandes / stats).
export const revenueAdjustmentPaymentModeSchema = z.enum([
  'CASH',
  'WAVE',
  'OTHER',
]);

export type RevenueAdjustmentPaymentModeInput = z.infer<
  typeof revenueAdjustmentPaymentModeSchema
>;

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format YYYY-MM-DD');

const signedAmount = z
  .number()
  .int('Montant entier (FCFA)')
  .refine((n) => n !== 0, 'Montant non nul requis')
  .refine(
    (n) => Math.abs(n) <= REVENUE_ADJUSTMENT_AMOUNT_MAX,
    'Montant trop élevé'
  );

const revenueAdjustmentObjectSchema = z.object({
  date: dateOnly,
  // Signé : positif = recette ajoutée au CA, négatif = recette retirée.
  amount: signedAmount,
  paymentMode: revenueAdjustmentPaymentModeSchema.optional(),
  note: z
    .string()
    .trim()
    .max(REVENUE_ADJUSTMENT_NOTE_MAX, 'Motif trop long')
    .nullable()
    .optional(),
});

export { revenueAdjustmentObjectSchema };

export const revenueAdjustmentInputSchema = revenueAdjustmentObjectSchema;

export type RevenueAdjustmentInput = z.infer<
  typeof revenueAdjustmentInputSchema
>;

// Mise à jour partielle : tous les champs deviennent optionnels.
export const revenueAdjustmentUpdateSchema = revenueAdjustmentObjectSchema
  .partial()
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'Au moins un champ à mettre à jour est requis',
  });

export type RevenueAdjustmentUpdateInput = z.infer<
  typeof revenueAdjustmentUpdateSchema
>;

// Filtres de liste (plage de jours civils + mode de paiement).
export const revenueAdjustmentFiltersSchema = z.object({
  from: dateOnly.optional(),
  to: dateOnly.optional(),
  paymentMode: revenueAdjustmentPaymentModeSchema.optional(),
});

export type RevenueAdjustmentFiltersInput = z.infer<
  typeof revenueAdjustmentFiltersSchema
>;
