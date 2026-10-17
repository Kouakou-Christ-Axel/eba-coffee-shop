// lib/cart-preorder.ts
//
// Produits à NE PAS précommander (`Product.preorderable = false`) : leur ligne
// ne se retire que le jour même. Prédicat pur dérivé de `items`, comme
// `isPrecommandeCart` (lib/cart-precommande.ts) — jamais un état stocké.

import type { CartItem } from '@/lib/cart-store';
import { effectiveItemAdvanceDays, isPreorderable } from '@/lib/supplements';

/** Lignes qui interdisent un retrait un autre jour. */
export function sameDayOnlyItems(items: CartItem[]): CartItem[] {
  return items.filter((i) => !isPreorderable(i));
}

/** Noms dédoublonnés, pour les messages. */
function names(items: CartItem[]): string {
  return [...new Set(items.map((i) => i.productName))].join(', ');
}

/**
 * Message si le panier mélange des articles du jour uniquement et des
 * articles qui exigent un autre jour (commande à l'avance, ou épuisés
 * aujourd'hui) : aucun créneau ne convient aux deux. `null` si compatible.
 */
export function preorderConflictMessage(items: CartItem[]): string | null {
  const sameDay = sameDayOnlyItems(items);
  if (sameDay.length === 0) return null;
  const needsLater = items.filter((i) => effectiveItemAdvanceDays(i) > 0);
  if (needsLater.length === 0) return null;
  return `${names(sameDay)} ne se commande que pour aujourd’hui, alors que ${names(needsLater)} se retire un autre jour. Passez deux commandes séparées.`;
}

/** Message quand un retrait un autre jour est choisi avec des articles du jour. */
export function sameDayOnlyMessage(items: CartItem[]): string {
  return `${names(sameDayOnlyItems(items))} ne peut pas être précommandé : choisissez un retrait aujourd’hui.`;
}
