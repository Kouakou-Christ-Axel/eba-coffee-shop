// lib/deposits.ts
//
// Acompte des commandes spéciales sur mesure (ex. gâteau grand format — cf.
// `Product.requiresDeposit`, prisma/schema.prisma). Purs, sans I/O : consommés
// par `lib/order-mutations.ts` (création de commande) et par les composants
// panier qui dénormalisent le drapeau produit sur la ligne (`CartItem`).

import { MIN_DEPOSIT_PERCENT } from '@/config/constants';

export type DepositCartItem = { requiresDeposit?: boolean };

/** Vrai si au moins un article du panier exige un acompte. */
export function cartRequiresDeposit(items: DepositCartItem[]): boolean {
  return items.some((it) => it.requiresDeposit);
}

/**
 * Montant minimum d'acompte (FCFA, arrondi au franc supérieur) pour ce panier,
 * ou `null` si aucun article ne l'exige. Calculé sur le TOTAL de la commande
 * entière dès qu'un article l'exige (pas seulement sa propre ligne) — en
 * pratique une commande spéciale n'est pas mélangée avec d'autres articles.
 */
export function computeRequiredDeposit(
  items: DepositCartItem[],
  total: number
): number | null {
  if (!cartRequiresDeposit(items)) return null;
  return Math.ceil((total * MIN_DEPOSIT_PERCENT) / 100);
}
