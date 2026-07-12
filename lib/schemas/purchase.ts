// lib/schemas/purchase.ts
//
// Schémas Zod centralisés pour le flux d'achat/dépense en deux temps
// (prepare → confirm, brouillon persisté avec TTL) exposé par le serveur MCP
// (Phase 2 du refactor dépenses/achats). Réutilise les constantes de
// config/constants.ts et `expensePaymentMethodSchema` (lib/schemas/expense.ts).
// Conformément à CLAUDE.md : pas de redéclaration inline ailleurs.

import { z } from 'zod';
import {
  EXPENSE_ITEM_LABEL_MAX,
  EXPENSE_ARTICLE_NAME_MAX,
  EXPENSE_ITEM_UNIT_MAX,
  EXPENSE_ITEM_QUANTITY_MAX,
  EXPENSE_AMOUNT_MAX,
  EXPENSE_SUPPLIER_MAX,
  EXPENSE_NOTE_MAX,
  EXPENSE_ITEMS_MAX,
} from '@/config/constants';
import { expensePaymentMethodSchema } from '@/lib/schemas/expense';

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format YYYY-MM-DD');

const amountField = z
  .number()
  .int('Montant entier (FCFA)')
  .min(0, 'Montant invalide')
  .max(EXPENSE_AMOUNT_MAX, 'Montant trop élevé');

const positiveAmountField = z
  .number()
  .int('Montant entier (FCFA)')
  .positive('Montant invalide')
  .max(EXPENSE_AMOUNT_MAX, 'Montant trop élevé');

const quantityField = z
  .number()
  .positive('Quantité invalide')
  .max(EXPENSE_ITEM_QUANTITY_MAX, 'Quantité trop élevée');

// ─── Étape 1 : préparation d'un achat (brouillon) ──────────────────────────────
//
// Une ligne d'achat brute, telle que saisie/détectée avant rapprochement au
// référentiel d'articles. `articleId` (si connu avec certitude) ou
// `articleName` (libellé normalisé à rapprocher) orientent le rapprochement
// effectué par `lib/purchase-drafts.ts::preparePurchase` — à défaut des deux,
// c'est `rawLabel` qui sert de clé de recherche.

export const purchaseLineInputSchema = z.object({
  rawLabel: z
    .string()
    .trim()
    .min(1, 'Libellé requis')
    .max(EXPENSE_ITEM_LABEL_MAX, 'Libellé trop long'),
  articleId: z.string().min(1).optional(),
  articleName: z
    .string()
    .trim()
    .min(1)
    .max(EXPENSE_ARTICLE_NAME_MAX, "Nom d'article trop long")
    .optional(),
  formatQty: quantityField.optional(),
  formatSize: quantityField.optional(),
  unit: z
    .string()
    .trim()
    .max(EXPENSE_ITEM_UNIT_MAX, 'Unité trop longue')
    .optional(),
  unitPrice: amountField.optional(),
  // Montant de la ligne (= lineTotal). Optionnel : dérivable de
  // formatQty × formatSize × unitPrice (voir `resolveExpenseItemAmount`).
  amount: amountField.optional(),
});

export type PurchaseLineInput = z.infer<typeof purchaseLineInputSchema>;

export const preparePurchaseSchema = z.object({
  date: dateOnly.optional(),
  supplier: z
    .string()
    .trim()
    .max(EXPENSE_SUPPLIER_MAX, 'Fournisseur trop long')
    .optional(),
  paymentMethod: expensePaymentMethodSchema.optional(),
  categoryId: z.string().min(1, 'Catégorie requise'),
  totalAmount: amountField.optional(),
  lines: z
    .array(purchaseLineInputSchema)
    .min(1, 'Au moins une ligne requise')
    .max(EXPENSE_ITEMS_MAX, 'Trop de lignes'),
});

export type PreparePurchaseInput = z.infer<typeof preparePurchaseSchema>;

// ─── Étape 2 : confirmation (avec résolutions optionnelles) ────────────────────
//
// `resolutions.lines[].index` référence l'INDEX de la ligne dans le tableau
// `lines` fourni à `preparePurchase` (pas un id — les lignes brutes n'en ont
// pas). `excluded: true` retire la ligne de la dépense finale (ex. doublon
// détecté, ligne à ressaisir plus tard).

export const purchaseLineResolutionSchema = z.object({
  index: z.number().int().min(0),
  articleId: z.string().min(1).optional(),
  articleName: z
    .string()
    .trim()
    .min(1)
    .max(EXPENSE_ARTICLE_NAME_MAX, "Nom d'article trop long")
    .optional(),
  formatQty: quantityField.optional(),
  formatSize: quantityField.optional(),
  unitPrice: amountField.optional(),
  amount: amountField.optional(),
  excluded: z.boolean().optional(),
});

export type PurchaseLineResolutionInput = z.infer<
  typeof purchaseLineResolutionSchema
>;

export const confirmPurchaseSchema = z.object({
  draftId: z.string().min(1, 'Identifiant de brouillon requis'),
  resolutions: z
    .object({
      lines: z.array(purchaseLineResolutionSchema).optional(),
      totalAmount: amountField.optional(),
    })
    .optional(),
});

export type ConfirmPurchaseInput = z.infer<typeof confirmPurchaseSchema>;

// ─── Dépense simple (sans détail par article) ──────────────────────────────────
//
// Flux allégé pour une dépense « globale » (pas de lignes/articles) : loyer,
// facture, abonnement… Le brouillon reste néanmoins obligatoire (pas d'écriture
// directe en une seule étape, cf. objectif Phase 2).

export const prepareOtherExpenseSchema = z.object({
  date: dateOnly.optional(),
  amount: positiveAmountField,
  categoryId: z.string().min(1, 'Catégorie requise'),
  note: z.string().trim().max(EXPENSE_NOTE_MAX, 'Note trop longue').optional(),
  paymentMethod: expensePaymentMethodSchema.optional(),
  supplier: z
    .string()
    .trim()
    .max(EXPENSE_SUPPLIER_MAX, 'Fournisseur trop long')
    .optional(),
});

export type PrepareOtherExpenseInput = z.infer<
  typeof prepareOtherExpenseSchema
>;

export const confirmExpenseDraftSchema = z.object({
  draftId: z.string().min(1, 'Identifiant de brouillon requis'),
});

export type ConfirmExpenseDraftInput = z.infer<
  typeof confirmExpenseDraftSchema
>;
