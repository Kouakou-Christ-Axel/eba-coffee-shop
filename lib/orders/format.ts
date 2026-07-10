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
 * Code de retrait court : le suffixe de la référence (`EBA-20260706-A3F9` →
 * « A3F9 »). C'est l'identifiant terrain annoncé par le client ou son livreur —
 * contrairement au n° du jour (#003) qui repart à 1 chaque matin, la référence
 * est unique en base, donc le code lève l'ambiguïté entre deux jours (la
 * recherche du dashboard matche `reference contains`).
 */
export function getPickupCode(reference: string): string {
  return reference.slice(reference.lastIndexOf('-') + 1);
}

/**
 * Forme "raw" d'une commande telle que reçue depuis un flux SSE : les champs
 * `Date` traversent JSON en chaînes ISO (ou `null`). `preparingStartedAt` /
 * `readyAt` sont optionnels : toutes les files ne les portent pas.
 */
export type RawOrderDates = {
  pickupTime: string | null;
  createdAt: string;
  preparingStartedAt?: string | null;
  readyAt?: string | null;
};

/**
 * Convertit les champs date d'une commande SSE (`pickupTime`, `createdAt`,
 * et les optionnels `preparingStartedAt` / `readyAt`) en objets `Date`.
 *
 * Pur, sans effet de bord — sûr côté serveur comme client. Conserve toutes
 * les autres clés inchangées via le spread, de sorte que le générique
 * passe par référence : tout type étendant `RawOrderDates` se retrouve avec
 * ces champs re-désérialisés en `Date` (ou `null`).
 */
export function normalizeOrderDates<T extends RawOrderDates>(
  raw: T
): Omit<T, 'pickupTime' | 'createdAt' | 'preparingStartedAt' | 'readyAt'> & {
  pickupTime: Date | null;
  createdAt: Date;
  preparingStartedAt: Date | null;
  readyAt: Date | null;
} {
  return {
    ...raw,
    pickupTime: raw.pickupTime ? new Date(raw.pickupTime) : null,
    createdAt: new Date(raw.createdAt),
    preparingStartedAt: raw.preparingStartedAt
      ? new Date(raw.preparingStartedAt)
      : null,
    readyAt: raw.readyAt ? new Date(raw.readyAt) : null,
  };
}
