// lib/orders/totals.ts
//
// Calcul centralisé des montants d'une ligne de commande et du total, avec
// prise en compte de la remise (montant fixe en FCFA, plafonnée par ligne).
//
// Source de vérité unique : utilisé côté client (panier, éditeur) ET serveur
// (route de création walk-in, action de mise à jour des articles). Aucune
// dépendance runtime sur le store Zustand (import de type uniquement).

import { MAX_LINE_DISCOUNT_RATIO } from '@/config/constants';
import type { CartItem } from '@/lib/cart-store';

/** Prix brut d'une ligne (base + suppléments) × quantité, avant remise. */
export function getItemGross(item: CartItem): number {
  const supplementsTotal = item.supplements.reduce(
    (s, x) => s + x.price * (x.quantity ?? 1),
    0
  );
  return (item.basePrice + supplementsTotal) * item.quantity;
}

/** Remise maximale autorisée sur une ligne (plafond métier, arrondi inférieur). */
export function getMaxItemDiscount(item: CartItem): number {
  return Math.floor(getItemGross(item) * MAX_LINE_DISCOUNT_RATIO);
}

/** Remise effective appliquée (bornée à [0, plafond]) — défense en profondeur. */
export function getItemDiscount(item: CartItem): number {
  const requested = item.discount ?? 0;
  return Math.min(Math.max(0, requested), getMaxItemDiscount(item));
}

/** Prix net d'une ligne après remise (jamais négatif). */
export function getItemNet(item: CartItem): number {
  return getItemGross(item) - getItemDiscount(item);
}

/** Total net d'une commande (somme des lignes après remise). */
export function computeItemsTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + getItemNet(item), 0);
}

/** Montant total des remises d'une commande. */
export function computeItemsDiscount(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + getItemDiscount(item), 0);
}
