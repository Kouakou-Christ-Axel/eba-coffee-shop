// lib/cart-precommande.ts
//
// Le panier bascule en mode précommande dès qu'une seule ligne porte
// `soldOutToday`, et en ressort automatiquement dès que la dernière de ces
// lignes disparaît (retrait, remplacement). Comme `isDeferredPickup`
// (lib/orders/scheduling.ts) est un prédicat PUR dérivé de `pickupTime`, le
// mode précommande est un prédicat PUR dérivé de `items` — jamais un
// deuxième état stocké qui pourrait se désynchroniser du panier réel.

import type { CartItem } from '@/lib/cart-store';
import { pickupDayString } from '@/lib/orders/scheduling';

/** Le panier contient-il au moins un article épuisé aujourd'hui ? */
export function isPrecommandeCart(items: CartItem[]): boolean {
  return items.some((item) => item.soldOutToday === true);
}

/**
 * Jour civil Abidjan (YYYY-MM-DD) du retrait en précommande : TOUJOURS
 * demain, jamais plus loin — contrairement à `advanceOrderDays` générique
 * (gâteau sur mesure), qui peut pousser à n'importe quel jour ≥ J+N.
 */
export function precommandeDay(): string {
  return pickupDayString(1);
}
