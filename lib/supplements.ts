// lib/supplements.ts
//
// Logique pure partagée par les deux interfaces de sélection de suppléments
// (caisse : `app/(dashboard)/dashboard/caisse/new/supplement-picker.tsx` et
// site public : `components/(public)/carte/supplement-modal.tsx`), pour éviter
// de dupliquer les règles de validation (min/max, quantité par option) entre
// les deux composants.
//
// Un groupe a trois types :
//   - 'single'   : un seul choix (radio). minSelect/maxSelect ignorés.
//   - 'multiple' : cases à cocher, chaque option 0 ou 1 fois. minSelect/
//                  maxSelect bornent le NOMBRE d'options cochées.
//   - 'quantity' : chaque option a un compteur (0..N). minSelect/maxSelect
//                  bornent la SOMME des quantités (ex. répartir 3 parts entre
//                  3 goûts : minSelect = maxSelect = 3).

import type { Product, SupplementGroup } from '@/config/menu';
import type { CartItemSupplement } from '@/lib/cart-store';

/**
 * Un produit en pause programmée (`unavailableUntil` dans le futur) est
 * toujours visible sur la carte/le dashboard (pas de masquage dur) mais non
 * commandable. La reprise est calculée à la LECTURE (pas de cron) : dès que
 * `now` dépasse `unavailableUntil`, le produit redevient commandable sans
 * intervention. Client-safe (pas d'import Prisma) : utilisable depuis les
 * composants client (dashboard ET carte publique).
 */
export function isPausedNow(
  unavailableUntil: Date | string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!unavailableUntil) return false;
  const until =
    typeof unavailableUntil === 'string'
      ? new Date(unavailableUntil)
      : unavailableUntil;
  return until.getTime() > now.getTime();
}

/** Sélection pour un groupe : nom d'option ('single'), noms cochés
 * ('multiple'), ou quantité par nom d'option ('quantity'). */
export type GroupSelection = string | string[] | Record<string, number>;
export type Selections = Record<string, GroupSelection>;

export function buildInitialSelections(
  product: Product | null,
  initial: CartItemSupplement[]
): Selections {
  const out: Selections = {};
  (product?.supplements ?? []).forEach((group) => {
    const picked = initial.filter((s) => s.groupName === group.name);
    if (group.type === 'single') {
      out[group.name] = picked[0]?.optionName ?? '';
    } else if (group.type === 'multiple') {
      out[group.name] = picked.map((s) => s.optionName);
    } else {
      const qty: Record<string, number> = {};
      picked.forEach((s) => {
        qty[s.optionName] = s.quantity ?? 1;
      });
      out[group.name] = qty;
    }
  });
  return out;
}

/** Nombre de sélections pour un groupe : options cochées ('multiple') ou
 * somme des quantités ('quantity'). Toujours 0 ou 1 pour 'single'. */
export function groupSelectionCount(
  group: SupplementGroup,
  selections: Selections
): number {
  const sel = selections[group.name];
  if (group.type === 'single') {
    return typeof sel === 'string' && sel !== '' ? 1 : 0;
  }
  if (group.type === 'multiple') {
    return Array.isArray(sel) ? sel.length : 0;
  }
  const qty = (sel as Record<string, number>) ?? {};
  return Object.values(qty).reduce((s, n) => s + n, 0);
}

/** Quantité choisie pour une option précise (groupe type 'quantity'). */
export function optionQuantity(
  group: SupplementGroup,
  selections: Selections,
  optionName: string
): number {
  const sel = selections[group.name] as Record<string, number> | undefined;
  return sel?.[optionName] ?? 0;
}

/** Borne effective : `required` sert de minimum implicite (1) quand
 * `minSelect` n'est pas explicitement configuré — compatible avec les
 * groupes existants qui n'utilisaient que `required`. */
export function effectiveMin(group: SupplementGroup): number {
  if (group.minSelect != null) return group.minSelect;
  return group.required ? 1 : 0;
}

export function effectiveMax(group: SupplementGroup): number {
  if (group.type === 'single') return 1;
  return group.maxSelect ?? Infinity;
}

export function isGroupValid(
  group: SupplementGroup,
  selections: Selections
): boolean {
  if (group.type === 'single') {
    if (!group.required) return true;
    const sel = selections[group.name];
    return typeof sel === 'string' && sel !== '';
  }
  const count = groupSelectionCount(group, selections);
  return count >= effectiveMin(group) && count <= effectiveMax(group);
}

export function canSubmitSelections(
  product: Product,
  selections: Selections
): boolean {
  return (product.supplements ?? []).every((g) => isGroupValid(g, selections));
}

/** Convertit l'état de sélection en suppléments prêts pour le panier. */
export function getSelectedSupplements(
  product: Product,
  selections: Selections,
  /** Enregistrer aussi les choix 'single' gratuits (prix 0) — la caisse les
   * garde visibles en cuisine, le site public les omet historiquement. */
  includeFreeSingleChoice = true
): CartItemSupplement[] {
  const result: CartItemSupplement[] = [];
  (product.supplements ?? []).forEach((group) => {
    const sel = selections[group.name];
    if (group.type === 'single') {
      if (typeof sel === 'string' && sel) {
        const opt = group.options.find((o) => o.name === sel);
        if (opt && (includeFreeSingleChoice || opt.price > 0)) {
          result.push({
            groupName: group.name,
            optionName: opt.name,
            price: opt.price,
          });
        }
      }
    } else if (group.type === 'multiple') {
      if (Array.isArray(sel)) {
        sel.forEach((name) => {
          const opt = group.options.find((o) => o.name === name);
          if (opt) {
            result.push({
              groupName: group.name,
              optionName: opt.name,
              price: opt.price,
            });
          }
        });
      }
    } else {
      const qty = (sel as Record<string, number>) ?? {};
      group.options.forEach((opt) => {
        const n = qty[opt.name] ?? 0;
        if (n > 0) {
          result.push({
            groupName: group.name,
            optionName: opt.name,
            price: opt.price,
            quantity: n,
          });
        }
      });
    }
  });
  return result;
}

export function getSupplementsPrice(supplements: CartItemSupplement[]): number {
  return supplements.reduce((sum, s) => sum + s.price * (s.quantity ?? 1), 0);
}

/** Libellé d'aide affiché sous le nom du groupe (ex. « Choisissez entre 1 et
 * 3 » ou « Répartissez exactement 3 »). `null` = rien à afficher. */
export function groupConstraintLabel(group: SupplementGroup): string | null {
  const min = effectiveMin(group);
  const max = group.type === 'single' ? 1 : (group.maxSelect ?? null);

  if (group.type === 'quantity') {
    if (max != null && max === min) return `Répartissez exactement ${max}`;
    if (max != null) return `Répartissez entre ${min} et ${max}`;
    return min > 0 ? `Répartissez au moins ${min}` : null;
  }
  if (group.type === 'multiple') {
    if (max != null && max === min && min > 0)
      return `Choisissez exactement ${max}`;
    if (max != null) return `Choisissez jusqu'à ${max}`;
    return null;
  }
  return null;
}
