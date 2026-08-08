'use client';

// lib/hooks/use-cart-summary.ts
//
// Résumé du panier (nombre d'articles + total net) pour les indicateurs :
// bouton flottant de /carte et icône panier de la navbar. Source unique du
// calcul — le total passe par `getItemTotal` (→ `getItemNet`, lib/orders/
// totals.ts), qui tient compte des remises de ligne et des suppléments à
// quantité, contrairement aux recalculs inline qu'il remplace.

import { useCartStore, useCartHydration, getItemTotal } from '@/lib/cart-store';

export type CartSummary = {
  /** Réhydratation localStorage terminée (voir `useCartHydration`). */
  hydrated: boolean;
  totalItems: number;
  /** Total net en FCFA. */
  totalPrice: number;
};

export function useCartSummary(): CartSummary {
  // Déclenche la réhydratation persistée : l'indicateur réapparaît après un
  // refresh ou une navigation depuis une autre page.
  const hydrated = useCartHydration();
  // Sélecteur ciblé : ne re-rend que sur changement de `items`.
  const items = useCartStore((s) => s.items);

  return {
    hydrated,
    totalItems: items.reduce((sum, i) => sum + i.quantity, 0),
    totalPrice: items.reduce((sum, i) => sum + getItemTotal(i), 0),
  };
}
