// lib/expense-item-draft.ts
//
// Modèle d'une ligne de détail EN COURS DE SAISIE : toutes les valeurs sont les
// chaînes brutes des inputs, la conversion vers le payload serveur se fait en
// un seul point (`draftsToItemsInput`).
//
// Cette logique portait l'invariant `sum(items) === amount` (imposé par
// `createExpense`/`updateExpense`) tout en vivant dans le corps du composant,
// donc sans aucun test. C'est la raison d'être de ce module : la sortir du JSX
// pour la couvrir.
//
// Pur : aucune dépendance Prisma ni React.

import { EXPENSE_ITEMS_MAX, EXPENSE_ITEM_LABEL_MAX } from '@/config/constants';
import { convertUnitPrice } from '@/lib/expense-units';
import type { ExpenseArticleOption } from '@/lib/expense-article-search';
import type { ExpenseItemInput } from '@/lib/schemas/expense';

/** Ligne de détail en cours de saisie (chaînes brutes des inputs). */
export type ExpenseItemDraft = {
  /** Article rattaché — `null` = nouvel article, créé à l'enregistrement. */
  articleId: string | null;
  rawLabel: string;
  label: string;
  formatQty: string;
  formatSize: string;
  unit: string;
  unitPrice: string;
  amount: string;
  pendingQuantity: boolean;
  /**
   * Vrai tant que `unitPrice` provient du prix moyen de l'article et n'a pas
   * été édité à la main. Purement client : jamais envoyé au serveur. Sert à
   * savoir si on peut reconvertir le prix quand l'unité change.
   */
  unitPriceIsSuggestion: boolean;
};

export function emptyExpenseItemDraft(): ExpenseItemDraft {
  return {
    articleId: null,
    rawLabel: '',
    label: '',
    formatQty: '',
    formatSize: '',
    unit: '',
    unitPrice: '',
    amount: '',
    pendingQuantity: false,
    unitPriceIsSuggestion: false,
  };
}

/** Nombre fini positif ou nul lu depuis un input, sinon `null`. */
function readNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

/**
 * Ligne pré-remplie depuis un article du référentiel : il ne reste que la
 * quantité à saisir. Le prix moyen est exprimé dans l'unité de base de
 * l'article, d'où le passage par `convertUnitPrice` — qui refuse de suggérer un
 * prix que l'arrondi à l'entier fausserait (cf. articles en `g`/`mL`).
 */
export function draftFromArticle(
  article: ExpenseArticleOption
): ExpenseItemDraft {
  const unit = article.baseUnit ?? '';
  const suggested = convertUnitPrice({
    price: article.lastUnitPrice,
    fromUnit: article.baseUnit,
    toUnit: unit || article.baseUnit,
  });

  return {
    ...emptyExpenseItemDraft(),
    articleId: article.id,
    rawLabel: article.name,
    unit,
    unitPrice: suggested == null ? '' : String(suggested),
    unitPriceIsSuggestion: suggested != null,
  };
}

/**
 * Applique un patch et recalcule le montant quand quantité et prix unitaire
 * sont exploitables (`qté × format × PU`, arrondi au franc).
 *
 * Deux règles d'ergonomie à préserver :
 *   - un patch qui touche `amount` n'entraîne JAMAIS de recalcul (la saisie
 *     manuelle du montant est prioritaire) ;
 *   - changer l'unité reconvertit le prix unitaire UNIQUEMENT s'il vient encore
 *     de la suggestion — un prix tapé à la main n'est jamais réécrit.
 */
export function applyDraftPatch(
  draft: ExpenseItemDraft,
  patch: Partial<ExpenseItemDraft>
): ExpenseItemDraft {
  const next: ExpenseItemDraft = { ...draft, ...patch };

  // Un prix saisi à la main cesse définitivement d'être une suggestion.
  if (
    patch.unitPrice !== undefined &&
    patch.unitPriceIsSuggestion === undefined
  ) {
    next.unitPriceIsSuggestion = false;
  }

  // Changement d'unité : reconvertir la suggestion pour rester cohérent.
  if (
    patch.unit !== undefined &&
    patch.unit !== draft.unit &&
    next.unitPriceIsSuggestion &&
    draft.unitPrice.trim().length > 0
  ) {
    const converted = convertUnitPrice({
      price: readNumber(draft.unitPrice),
      fromUnit: draft.unit,
      toUnit: next.unit,
    });
    next.unitPrice = converted == null ? '' : String(converted);
    next.unitPriceIsSuggestion = converted != null;
  }

  const touchesComputation =
    'formatQty' in patch ||
    'formatSize' in patch ||
    'unitPrice' in patch ||
    'unit' in patch;

  if (touchesComputation && !('amount' in patch)) {
    const qty = readNumber(next.formatQty);
    const price = readNumber(next.unitPrice);
    const size =
      next.formatSize.trim().length > 0 ? readNumber(next.formatSize) : 1;
    if (qty != null && qty > 0 && price != null && size != null) {
      next.amount = String(Math.round(qty * size * price));
    }
  }

  return next;
}

/** Somme des montants saisis (une ligne non numérique compte 0). */
export function draftsTotal(drafts: readonly ExpenseItemDraft[]): number {
  return drafts.reduce((sum, draft) => {
    const amount = readNumber(draft.amount);
    return sum + (amount == null ? 0 : Math.round(amount));
  }, 0);
}

/** Montant renseigné mais quantité absente : la quantité reste à compléter. */
export function isQuantityPending(draft: ExpenseItemDraft): boolean {
  return (
    readNumber(draft.amount) != null && readNumber(draft.formatQty) == null
  );
}

/**
 * Vrai si l'enregistrement créera un nouvel article pour cette ligne — c'est ce
 * que le badge « Nouveau » annonce. La création réelle est faite côté serveur
 * par `resolveItemArticle` → `ensureArticle`.
 */
export function willCreateArticle(draft: ExpenseItemDraft): boolean {
  return draft.articleId == null && draft.rawLabel.trim().length > 0;
}

export type DraftValidation =
  | { ok: true; items: ExpenseItemInput[]; total: number }
  | { ok: false; error: string };

/**
 * Valide les lignes et les convertit en payload serveur.
 *
 * `total` est calculé SUR le tableau `items` produit, jamais ailleurs : c'est
 * ce qui garantit l'invariant `sum(items) === amount` vérifié par
 * `createExpense`. L'appelant doit envoyer ce `total` comme montant.
 */
export function draftsToItemsInput(
  drafts: readonly ExpenseItemDraft[]
): DraftValidation {
  if (drafts.length > EXPENSE_ITEMS_MAX) {
    return {
      ok: false,
      error: `Trop de lignes : ${EXPENSE_ITEMS_MAX} au maximum.`,
    };
  }

  const items: ExpenseItemInput[] = [];

  for (const draft of drafts) {
    const rawLabel = draft.rawLabel.trim();
    if (rawLabel.length === 0) {
      return {
        ok: false,
        error: 'Chaque ligne doit avoir un libellé (ex. « Farine T45 »).',
      };
    }
    if (rawLabel.length > EXPENSE_ITEM_LABEL_MAX) {
      return {
        ok: false,
        error: `Libellé trop long : ${EXPENSE_ITEM_LABEL_MAX} caractères au maximum.`,
      };
    }

    const amount = readNumber(draft.amount);
    if (amount == null) {
      return {
        ok: false,
        error: `Ligne « ${rawLabel} » : montant invalide (saisis une quantité × prix unitaire, ou un montant direct).`,
      };
    }

    items.push({
      articleId: draft.articleId ?? undefined,
      articleName: draft.articleId ? undefined : rawLabel,
      rawLabel,
      label: draft.label.trim() || null,
      formatQty: readNumber(draft.formatQty),
      formatSize: readNumber(draft.formatSize),
      unit: draft.unit.trim() || null,
      unitPrice: (() => {
        const price = readNumber(draft.unitPrice);
        return price == null ? null : Math.round(price);
      })(),
      amount: Math.round(amount),
      pendingQuantity: draft.pendingQuantity || undefined,
    });
  }

  const total = items.reduce((sum, item) => sum + (item.amount ?? 0), 0);
  if (total <= 0) {
    return {
      ok: false,
      error: 'Le total des lignes doit être supérieur à 0 F.',
    };
  }

  return { ok: true, items, total };
}
