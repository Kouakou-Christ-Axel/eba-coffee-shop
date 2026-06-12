// lib/schemas/investment.ts
//
// Schémas Zod centralisés pour les investissements (apports / financements) :
// sources de financement + apports. Miroir de lib/schemas/expense.ts. Réutilisés
// par les server actions du dashboard, la route d'export et le serveur MCP.
// Conformément à CLAUDE.md : pas de redéclaration inline ailleurs.

import { z } from 'zod';
import {
  INVESTMENT_SOURCE_NAME_MAX,
  INVESTMENT_FINANCIER_MAX,
  INVESTMENT_NOTE_MAX,
  INVESTMENT_AMOUNT_MAX,
} from '@/config/constants';
import { imageUrlSchema } from '@/lib/schemas/upload';

// ─── Sources de financement ───────────────────────────────────────────────────

export const investmentSourceInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Nom requis')
    .max(INVESTMENT_SOURCE_NAME_MAX, 'Nom trop long'),
});

export const investmentSourceUpdateSchema = investmentSourceInputSchema;

export type InvestmentSourceInput = z.infer<typeof investmentSourceInputSchema>;

// ─── Apports ──────────────────────────────────────────────────────────────────

export const investmentPaymentMethodSchema = z.enum([
  'CASH',
  'WAVE',
  'BANK',
  'OTHER',
]);

export type InvestmentPaymentMethodInput = z.infer<
  typeof investmentPaymentMethodSchema
>;

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format YYYY-MM-DD');

// Objet « nu » (sans contrainte croisée) — base réutilisable pour `.partial()` et
// `.extend()` (impossibles après un `.refine`, cf. schéma MCP `update_investment`).
const investmentObjectSchema = z.object({
  date: dateOnly,
  amount: z
    .number()
    .int('Montant entier (FCFA)')
    .positive('Montant invalide')
    .max(INVESTMENT_AMOUNT_MAX, 'Montant trop élevé'),
  sourceId: z.string().min(1, 'Source requise'),
  // Optionnel (pas de `.default` ici : un défaut casserait la règle
  // « au moins un champ » de `investmentUpdateSchema`). Défaut CASH appliqué à
  // la création dans `createInvestment`.
  paymentMethod: investmentPaymentMethodSchema.optional(),
  financier: z
    .string()
    .trim()
    .max(INVESTMENT_FINANCIER_MAX, 'Financeur trop long')
    .nullable()
    .optional(),
  note: z
    .string()
    .trim()
    .max(INVESTMENT_NOTE_MAX, 'Note trop longue')
    .nullable()
    .optional(),
  documentUrl: imageUrlSchema.nullable().optional(),
  reimbursable: z.boolean().optional(),
  amountRepaid: z
    .number()
    .int('Montant entier (FCFA)')
    .nonnegative('Montant remboursé invalide')
    .max(INVESTMENT_AMOUNT_MAX, 'Montant trop élevé')
    .optional(),
  dueDate: dateOnly.nullable().optional(),
});

// Le remboursé ne peut pas dépasser le montant de l'apport.
const repaidNotOverAmount = (v: { amount?: number; amountRepaid?: number }) =>
  v.amount === undefined ||
  v.amountRepaid === undefined ||
  v.amountRepaid <= v.amount;

export { investmentObjectSchema };

export const investmentInputSchema = investmentObjectSchema.refine(
  repaidNotOverAmount,
  {
    message: 'Le montant remboursé ne peut pas dépasser le montant de l’apport',
    path: ['amountRepaid'],
  }
);

export type InvestmentInput = z.infer<typeof investmentInputSchema>;

// Mise à jour partielle : tous les champs deviennent optionnels.
export const investmentUpdateSchema = investmentObjectSchema
  .partial()
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'Au moins un champ à mettre à jour est requis',
  })
  .refine(repaidNotOverAmount, {
    message: 'Le montant remboursé ne peut pas dépasser le montant de l’apport',
    path: ['amountRepaid'],
  });

export type InvestmentUpdateInput = z.infer<typeof investmentUpdateSchema>;

// Filtres de liste (plage de jours civils + source + remboursable).
export const investmentFiltersSchema = z.object({
  from: dateOnly.optional(),
  to: dateOnly.optional(),
  sourceId: z.string().min(1).optional(),
  reimbursable: z.boolean().optional(),
});

export type InvestmentFiltersInput = z.infer<typeof investmentFiltersSchema>;
