// lib/schemas/expense.ts
//
// Schémas Zod centralisés pour le suivi des dépenses (catégories + dépenses +
// détail par article). Réutilisés par les server actions du dashboard, les
// routes et le serveur MCP. Conformément à CLAUDE.md : pas de redéclaration
// inline ailleurs.
//
// Important : `expenseInputSchema` reste un `z.object` SANS `.refine()`/
// `.superRefine()` au niveau racine — `lib/mcp/tools.ts` (hors périmètre de ce
// step) appelle `expenseInputSchema.partial().extend({ id })`, et Zod 4
// interdit `.partial()` sur un schéma comportant des raffinements. Les
// invariants qui nécessitent un raffinement multi-champs (somme des lignes ==
// montant, etc.) sont donc appliqués côté `lib/expense-mutations.ts`, pas ici.

import { z } from 'zod';
import {
  EXPENSE_CATEGORY_NAME_MAX,
  EXPENSE_SUPPLIER_MAX,
  EXPENSE_NOTE_MAX,
  EXPENSE_AMOUNT_MAX,
  EXPENSE_RECURRING_LABEL_MAX,
  EXPENSE_ARTICLE_NAME_MAX,
  EXPENSE_ITEM_LABEL_MAX,
  EXPENSE_ITEM_UNIT_MAX,
  EXPENSE_ITEMS_MAX,
  EXPENSE_ITEM_QUANTITY_MAX,
} from '@/config/constants';
import { imageUrlSchema } from '@/lib/schemas/upload';
import { BASE_UNITS } from '@/lib/expense-units';

// ─── Catégories de dépense ────────────────────────────────────────────────────

// FIXED = charge fixe (loyer, salaires, abonnements…), VARIABLE = achat
// courant. Porté par la catégorie (cf. prisma `ExpenseNature`), défaut VARIABLE.
export const expenseNatureSchema = z.enum(['FIXED', 'VARIABLE']);

export type ExpenseNatureInput = z.infer<typeof expenseNatureSchema>;

export const expenseCategoryInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Nom requis')
    .max(EXPENSE_CATEGORY_NAME_MAX, 'Nom trop long'),
  // Optionnelle : défaut VARIABLE côté DB.
  nature: expenseNatureSchema.optional(),
});

export const expenseCategoryUpdateSchema = expenseCategoryInputSchema
  .partial()
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'Au moins un champ à mettre à jour est requis',
  });

export type ExpenseCategoryInput = z.infer<typeof expenseCategoryInputSchema>;
export type ExpenseCategoryUpdateInput = z.infer<
  typeof expenseCategoryUpdateSchema
>;

// ─── Dépenses ─────────────────────────────────────────────────────────────────

export const expensePaymentMethodSchema = z.enum([
  'CASH',
  'WAVE',
  'BANK',
  'OTHER',
]);

export type ExpensePaymentMethodInput = z.infer<
  typeof expensePaymentMethodSchema
>;

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format YYYY-MM-DD');

// ─── Lignes de détail (articles) ──────────────────────────────────────────────
//
// `rawLabel` = libellé brut saisi, toujours renseigné (traçabilité — même si
// la ligne n'est jamais rapprochée d'un article). `articleId` désigne un
// article existant ; à défaut, `articleName` (ou `rawLabel` si absent) sert de
// clé d'auto-création/dédup (voir `lib/expense-matching.ts::ensureArticle`).
// `amount` peut être omis quand `unitPrice` + `formatQty` suffisent à le
// dériver (formatQty × formatSize × unitPrice, arrondi au franc) ; `.min(0)`
// (pas `.positive()`) sur `amount`/`unitPrice` pour tolérer les lignes de
// réappro gratuites et les lignes « en attente » (`pendingQuantity`).
export const expenseItemInputSchema = z.object({
  articleId: z.string().min(1).optional(),
  // Texte libre pour l'auto-création MCP : prioritaire sur `rawLabel` comme
  // nom d'article si fourni (permet de saisir un libellé fournisseur brut
  // dans `rawLabel` et un nom d'article normalisé dans `articleName`).
  articleName: z
    .string()
    .trim()
    .min(1)
    .max(EXPENSE_ARTICLE_NAME_MAX, "Nom d'article trop long")
    .optional(),
  rawLabel: z
    .string()
    .trim()
    .min(1, 'Libellé requis')
    .max(EXPENSE_ITEM_LABEL_MAX, 'Libellé trop long'),
  label: z
    .string()
    .trim()
    .max(EXPENSE_ITEM_LABEL_MAX, 'Précision trop longue')
    .nullable()
    .optional(),
  formatQty: z
    .number()
    .positive('Quantité invalide')
    .max(EXPENSE_ITEM_QUANTITY_MAX, 'Quantité trop élevée')
    .nullable()
    .optional(),
  formatSize: z
    .number()
    .positive('Taille de format invalide')
    .max(EXPENSE_ITEM_QUANTITY_MAX, 'Taille de format trop élevée')
    .nullable()
    .optional(),
  unit: z
    .string()
    .trim()
    .max(EXPENSE_ITEM_UNIT_MAX, 'Unité trop longue')
    .nullable()
    .optional(),
  unitPrice: z
    .number()
    .int('Prix unitaire entier (FCFA)')
    .min(0, 'Prix unitaire invalide')
    .max(EXPENSE_AMOUNT_MAX, 'Prix unitaire trop élevé')
    .nullable()
    .optional(),
  // Optionnel : dérivé de formatQty × formatSize × unitPrice si absent (voir
  // `resolveExpenseItemAmount`). `.min(0)` : une ligne à 0 F est valide
  // (échantillon gratuit, réappro sans coût).
  amount: z
    .number()
    .int('Montant entier (FCFA)')
    .min(0, 'Montant invalide')
    .max(EXPENSE_AMOUNT_MAX, 'Montant trop élevé')
    .optional(),
  // Montant connu mais quantité pas encore renseignée (à compléter plus tard).
  pendingQuantity: z.boolean().optional(),
});

export type ExpenseItemInput = z.infer<typeof expenseItemInputSchema>;

/**
 * Montant effectif d'une ligne : fourni directement, sinon dérivé de
 * `formatQty × (formatSize ?? 1) × unitPrice` (arrondi au franc). Renvoie
 * `null` quand ni l'un ni l'autre n'est calculable — l'appelant décide alors
 * de refuser la ligne (message explicite, cf. `lib/expense-mutations.ts`).
 */
export function resolveExpenseItemAmount(item: {
  amount?: number | null;
  formatQty?: number | null;
  formatSize?: number | null;
  unitPrice?: number | null;
}): number | null {
  if (item.amount !== undefined && item.amount !== null) return item.amount;
  if (item.unitPrice == null || item.formatQty == null) return null;
  const size = item.formatSize ?? 1;
  return Math.round(item.formatQty * size * item.unitPrice);
}

const expenseItemsArraySchema = z
  .array(expenseItemInputSchema)
  .max(EXPENSE_ITEMS_MAX, 'Trop de lignes de détail');

// ─── Dépense ──────────────────────────────────────────────────────────────────

export const expenseInputSchema = z.object({
  date: dateOnly,
  amount: z
    .number()
    .int('Montant entier (FCFA)')
    .positive('Montant invalide')
    .max(EXPENSE_AMOUNT_MAX, 'Montant trop élevé'),
  categoryId: z.string().min(1, 'Catégorie requise'),
  // Optionnel (pas de `.default` ici : un défaut casserait la règle
  // « au moins un champ » de `expenseUpdateSchema`). Défaut CASH appliqué à
  // la création dans `createExpense`.
  paymentMethod: expensePaymentMethodSchema.optional(),
  supplier: z
    .string()
    .trim()
    .max(EXPENSE_SUPPLIER_MAX, 'Fournisseur trop long')
    .nullable()
    .optional(),
  note: z
    .string()
    .trim()
    .max(EXPENSE_NOTE_MAX, 'Note trop longue')
    .nullable()
    .optional(),
  receiptUrl: imageUrlSchema.nullable().optional(),
  // Détail par article : `undefined` = dépense « globale » (comportement
  // historique) ; tableau = détail fourni ; `null` accepté aussi en création
  // par symétrie avec la mise à jour (équivaut à omettre le champ).
  items: expenseItemsArraySchema.nullable().optional(),
});

export type ExpenseInput = z.infer<typeof expenseInputSchema>;

// Mise à jour partielle : tous les champs deviennent optionnels. `items:
// undefined` = ne pas toucher au détail ; `items: null` = retirer tout le
// détail (la dépense redevient « globale ») ; `items: [...]` = remplacement
// complet des lignes. Cf. `updateExpense` pour les invariants (somme des
// lignes == montant, refus de changer le montant seul sur une dépense
// détaillée) — non exprimables ici sans `.superRefine()` (voir note d'en-tête).
export const expenseUpdateSchema = expenseInputSchema
  .partial()
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'Au moins un champ à mettre à jour est requis',
  });

export type ExpenseUpdateInput = z.infer<typeof expenseUpdateSchema>;

// Filtres de liste (plage de jours civils + catégorie + paiement + recherche).
export const expenseFiltersSchema = z.object({
  from: dateOnly.optional(),
  to: dateOnly.optional(),
  categoryId: z.string().min(1).optional(),
  paymentMethod: expensePaymentMethodSchema.optional(),
  search: z.string().trim().min(1).optional(),
});

export type ExpenseFiltersInput = z.infer<typeof expenseFiltersSchema>;

// Filtres des stats de fréquence d'achat par article (défaut : mois civil en
// cours, appliqué par l'appelant — `search` matche le nom d'article).
export const expenseFrequencyFiltersSchema = z.object({
  from: dateOnly.optional(),
  to: dateOnly.optional(),
  search: z.string().trim().min(1).optional(),
});

export type ExpenseFrequencyFiltersInput = z.infer<
  typeof expenseFrequencyFiltersSchema
>;

// ─── Référentiel d'articles ───────────────────────────────────────────────────

export const expenseArticleRenameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Nom requis')
    .max(EXPENSE_ARTICLE_NAME_MAX, 'Nom trop long'),
});

export type ExpenseArticleRenameInput = z.infer<
  typeof expenseArticleRenameSchema
>;

// Réglages d'un article (unité de base, suivi de stock, emplacement, prix de
// référence, lien inventaire). Tous les champs sont optionnels — mise à jour
// partielle, au moins un champ requis.
export const expenseArticleSettingsSchema = z
  .object({
    baseUnit: z.enum(BASE_UNITS).nullable().optional(),
    trackInventory: z.boolean().optional(),
    location: z
      .string()
      .trim()
      .max(EXPENSE_NOTE_MAX, 'Emplacement trop long')
      .nullable()
      .optional(),
    wholesaleRefPrice: z
      .number()
      .int('Prix entier (FCFA)')
      .min(0, 'Prix invalide')
      .max(EXPENSE_AMOUNT_MAX, 'Prix trop élevé')
      .nullable()
      .optional(),
    inventoryItemId: z.string().min(1).nullable().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'Au moins un champ à mettre à jour est requis',
  });

export type ExpenseArticleSettingsInput = z.infer<
  typeof expenseArticleSettingsSchema
>;

// Fusion de deux articles (dédoublonnage) : `sourceId` est absorbé par
// `targetId` (jamais l'inverse).
export const articleMergeSchema = z
  .object({
    sourceId: z.string().min(1, 'Article source requis'),
    targetId: z.string().min(1, 'Article cible requis'),
  })
  .refine((v) => v.sourceId !== v.targetId, {
    message: 'Impossible de fusionner un article avec lui-même',
    path: ['targetId'],
  });

export type ArticleMergeInput = z.infer<typeof articleMergeSchema>;

// Re-rattache une ligne de dépense existante à un autre article (correction
// d'un rapprochement erroné) — apprend l'alias correspondant.
export const relinkExpenseItemSchema = z.object({
  itemId: z.string().min(1, 'Ligne requise'),
  articleId: z.string().min(1, 'Article requis'),
});

export type RelinkExpenseItemInput = z.infer<typeof relinkExpenseItemSchema>;

// ─── Dépenses récurrentes (modèles / aide-mémoire) ─────────────────────────────

export const recurringExpenseInputSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, 'Libellé requis')
    .max(EXPENSE_RECURRING_LABEL_MAX, 'Libellé trop long'),
  categoryId: z.string().min(1, 'Catégorie requise'),
  expectedAmount: z
    .number()
    .int('Montant entier (FCFA)')
    .positive('Montant invalide')
    .max(EXPENSE_AMOUNT_MAX, 'Montant trop élevé')
    .nullable()
    .optional(),
  dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
  active: z.boolean().optional(),
});

export type RecurringExpenseInput = z.infer<typeof recurringExpenseInputSchema>;

export const recurringExpenseUpdateSchema = recurringExpenseInputSchema
  .partial()
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'Au moins un champ à mettre à jour est requis',
  });

export type RecurringExpenseUpdateInput = z.infer<
  typeof recurringExpenseUpdateSchema
>;
