// lib/orders/visibility.ts
//
// Visibilité STAFF des commandes. Une commande en ligne en attente de paiement
// Jèko — ou abandonnée (expirée, annulée avant de payer) — ne doit apparaître ni à
// la caisse, ni en cuisine, ni dans les stats : le client n'a rien payé, rien ne
// doit être préparé, et une commande fantôme gonflerait le nombre d'annulations.
//
// Elle se reconnaît à `paymentExpiresAt` non nul tant qu'elle n'est pas payée
// (cf. `Order.paymentExpiresAt`). Les commandes caisse et MCP n'en portent jamais.
// Une commande dont le stock a manqué après paiement voit `paymentExpiresAt`
// remis à nul (cf. lib/jeko/settle.ts) : elle redevient visible, à encaisser.
//
// Les pages client (suivi par identifiant) lisent par `findUnique` et ne passent
// pas par ici : le client voit toujours sa propre commande.

import type { Prisma } from '@/generated/prisma/client';

export const STAFF_VISIBLE: Prisma.OrderWhereInput = {
  OR: [{ paymentExpiresAt: null }, { isPaid: true }],
};

/** Même règle que `STAFF_VISIBLE`, pour du code qui a déjà la ligne en mémoire. */
export function isHiddenFromStaff(order: {
  paymentExpiresAt: Date | null;
  isPaid: boolean;
}): boolean {
  return order.paymentExpiresAt !== null && !order.isPaid;
}

/**
 * Ajoute la règle de visibilité à une clause existante. `AND` plutôt qu'un
 * `spread` : beaucoup de requêtes portent déjà un `OR` ou un `AND` qu'un `spread`
 * écraserait en silence.
 */
export function withStaffVisible(
  where?: Prisma.OrderWhereInput
): Prisma.OrderWhereInput {
  return where ? { AND: [where, STAFF_VISIBLE] } : STAFF_VISIBLE;
}
