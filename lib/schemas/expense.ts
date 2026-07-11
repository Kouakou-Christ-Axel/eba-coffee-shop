// lib/schemas/expense.ts
//
// Schémas Zod centralisés pour le suivi des dépenses (catégories + dépenses).
// Réutilisés par les server actions du dashboard, les routes et le serveur MCP.
// Conformément à CLAUDE.md : pas de redéclaration inline ailleurs.

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

// ─── Catégories de dépense ────────────────────────────────────────────────────

// FIXED = charges fixes (loyer, salaires, abonnements…), VARIABLE = achats
// variables. La nature est portée par la catégorie (cf. prisma ExpenseNature).
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

// Une ligne désigne son article par `articleId` (référentiel existant) OU par
// `articleName` en texte libre : l'article est alors retrouvé par nom
// normalisé, ou créé à la volée. Le montant de ligne peut être omis quand
// quantity + unitPrice suffisent à le dériver (arrondi au franc).
export const expenseItemInputSchema = z
  .object({
    articleId: z.string().min(1).optional(),
    articleName: z
      .string()
      .trim()
      .min(1, 'Article requis')
      .max(EXPENSE_ARTICLE_NAME_MAX, "Nom d'article trop long")
      .optional(),
    // Lien optionnel vers un item d'inventaire : tamponné sur l'article à sa
    // création/résolution (unification réappros ↔ dépenses).
    inventoryItemId: z.string().min(1).nullable().optional(),
    label: z
      .string()
      .trim()
      .max(EXPENSE_ITEM_LABEL_MAX, 'Précision trop longue')
      .nullable()
      .optional(),
    quantity: z
      .number()
      .positive('Quantité invalide')
      .max(EXPENSE_ITEM_QUANTITY_MAX, 'Quantité trop élevée')
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
      .positive('Prix unitaire invalide')
      .max(EXPENSE_AMOUNT_MAX, 'Prix unitaire trop élevé')
      .nullable()
      .optional(),
    amount: z
      .number()
      .int('Montant entier (FCFA)')
      .positive('Montant invalide')
      .max(EXPENSE_AMOUNT_MAX, 'Montant trop élevé')
      .optional(),
  })
  .refine((v) => (v.articleId != null) !== (v.articleName != null), {
    message: 'Renseigner articleId OU articleName (exactement un des deux)',
    path: ['articleName'],
  })
  .refine(
    (v) =>
      v.amount !== undefined || (v.quantity != null && v.unitPrice != null),
    {
      message: 'Chaque ligne exige un montant, ou quantité + prix unitaire',
      path: ['amount'],
    }
  )
  .refine(
    (v) =>
      v.amount === undefined ||
      v.quantity == null ||
      v.unitPrice == null ||
      Math.abs(v.amount - Math.round(v.quantity * v.unitPrice)) <= 1,
    {
      message: 'Montant incohérent avec quantité × prix unitaire',
      path: ['amount'],
    }
  );

export type ExpenseItemInput = z.infer<typeof expenseItemInputSchema>;

/** Montant effectif d'une ligne : fourni, sinon dérivé de quantité × PU. */
export function resolveExpenseItemAmount(item: {
  amount?: number;
  quantity?: number | null;
  unitPrice?: number | null;
}): number {
  return (
    item.amount ?? Math.round((item.quantity ?? 0) * (item.unitPrice ?? 0))
  );
}

const expenseItemsArraySchema = z
  .array(expenseItemInputSchema)
  .min(1, 'Au moins une ligne')
  .max(EXPENSE_ITEMS_MAX, 'Trop de lignes de détail');

// Cohérence dépense ↔ lignes : la somme des lignes (montants dérivés compris)
// doit rester un montant valide et égaler `amount` quand il est fourni.
function checkExpenseItemsSum(
  v: { amount?: number; items?: ExpenseItemInput[] | null },
  ctx: z.core.$RefinementCtx
) {
  if (!v.items || v.items.length === 0) return;
  const sum = v.items.reduce((s, i) => s + resolveExpenseItemAmount(i), 0);
  if (sum < 1 || sum > EXPENSE_AMOUNT_MAX) {
    ctx.addIssue({
      code: 'custom',
      path: ['items'],
      message: 'Total des lignes invalide',
    });
    return;
  }
  if (v.amount !== undefined && v.amount !== sum) {
    ctx.addIssue({
      code: 'custom',
      path: ['amount'],
      message: `La somme des lignes (${sum} F) doit égaler le montant — ou omettre le montant pour qu'il soit dérivé`,
    });
  }
}

// ─── Dépense ──────────────────────────────────────────────────────────────────

// Raw shape partagé create/update : les `.refine` empêchent un `.partial()`
// après coup, on compose donc les deux schémas sur la même base.
const expenseBaseShape = {
  date: dateOnly,
  // Optionnel : requis sans `items`, dérivé (= somme des lignes) avec.
  amount: z
    .number()
    .int('Montant entier (FCFA)')
    .positive('Montant invalide')
    .max(EXPENSE_AMOUNT_MAX, 'Montant trop élevé')
    .optional(),
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
};

export const expenseInputSchema = z
  .object({ ...expenseBaseShape, items: expenseItemsArraySchema.optional() })
  .superRefine((v, ctx) => {
    if (v.amount === undefined && !v.items) {
      ctx.addIssue({
        code: 'custom',
        path: ['amount'],
        message: 'Montant requis (ou fournir des lignes de détail)',
      });
    }
    checkExpenseItemsSum(v, ctx);
  });

export type ExpenseInput = z.infer<typeof expenseInputSchema>;

// Mise à jour partielle : tous les champs deviennent optionnels.
// `items` = replace-all du détail ; `items: null` = retirer tout le détail.
export const expenseUpdateSchema = z
  .object({ ...expenseBaseShape, items: expenseItemsArraySchema.nullable() })
  .partial()
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'Au moins un champ à mettre à jour est requis',
  })
  .superRefine(checkExpenseItemsSum);

export type ExpenseUpdateInput = z.infer<typeof expenseUpdateSchema>;

// Variante « objet nu » du update (sans refinements — Zod 4 interdit
// `.partial()`/`.extend()` sur un schéma raffiné) pour l'`inputSchema` MCP.
// La validation fine (somme des lignes, « au moins un champ »…) reste
// appliquée par `updateExpense`, qui re-parse avec `expenseUpdateSchema`.
export const expenseUpdateObjectSchema = z
  .object({ ...expenseBaseShape, items: expenseItemsArraySchema.nullable() })
  .partial();

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

// Filtres des stats de fréquence par article (défaut : mois en cours, géré
// par l'appelant). `search` matche le nom d'article (contains, insensible).
export const expenseFrequencyFiltersSchema = z.object({
  from: dateOnly.optional(),
  to: dateOnly.optional(),
  search: z.string().trim().min(1).optional(),
});

export type ExpenseFrequencyFiltersInput = z.infer<
  typeof expenseFrequencyFiltersSchema
>;

// Filtres de liste (plage de jours civils + catégorie + paiement + recherche).
export const expenseFiltersSchema = z.object({
  from: dateOnly.optional(),
  to: dateOnly.optional(),
  categoryId: z.string().min(1).optional(),
  paymentMethod: expensePaymentMethodSchema.optional(),
  search: z.string().trim().min(1).optional(),
});

export type ExpenseFiltersInput = z.infer<typeof expenseFiltersSchema>;

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
