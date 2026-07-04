// lib/orders/format.ts
//
// Helpers de formatage / normalisation partagés entre les écrans dashboard
// qui consomment le flux SSE de commandes (caisse, préparation, ...).
//
// Les payloads SSE transitent en JSON : `pickupTime` et `createdAt` arrivent
// donc en chaîne ISO et doivent être re-désérialisés en `Date` côté client.

import type { CartItemSupplement } from '@/lib/cart-store';

/**
 * Libellé d'un supplément choisi, avec sa quantité si > 1 (ex. « Vanille
 * ×2 ») — pour les groupes type 'quantity' (répartition, ex. sponge cake).
 */
export function formatSupplementLabel(s: CartItemSupplement): string {
  return s.quantity && s.quantity > 1
    ? `${s.optionName} ×${s.quantity}`
    : s.optionName;
}

/**
 * Forme "raw" d'une commande telle que reçue depuis un flux SSE :
 * `pickupTime` et `createdAt` sont des chaînes ISO (ou `null` pour pickupTime).
 */
export type RawOrderDates = {
  pickupTime: string | null;
  createdAt: string;
};

/**
 * Convertit `pickupTime` / `createdAt` d'une commande SSE en objets `Date`.
 *
 * Pur, sans effet de bord — sûr côté serveur comme client. Conserve toutes
 * les autres clés inchangées via le spread, de sorte que le générique
 * passe par référence : tout type étendant `RawOrderDates` se retrouve avec
 * `pickupTime: Date | null` et `createdAt: Date` dans le résultat.
 */
export function normalizeOrderDates<T extends RawOrderDates>(
  raw: T
): Omit<T, 'pickupTime' | 'createdAt'> & {
  pickupTime: Date | null;
  createdAt: Date;
} {
  return {
    ...raw,
    pickupTime: raw.pickupTime ? new Date(raw.pickupTime) : null,
    createdAt: new Date(raw.createdAt),
  };
}
