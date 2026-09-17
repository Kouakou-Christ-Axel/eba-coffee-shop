// lib/orders/format.ts
//
// Helpers de formatage / normalisation partagés entre les écrans dashboard
// qui consomment le flux SSE de commandes (caisse, préparation, ...).
//
// Les payloads SSE transitent en JSON : `pickupTime` et `createdAt` arrivent
// donc en chaîne ISO et doivent être re-désérialisés en `Date` côté client.

import type { CartItem, CartItemSupplement } from '@/lib/cart-store';

/**
 * Libellé d'un supplément choisi, avec sa quantité si > 1 (ex. « Vanille
 * ×2 ») — pour les groupes type 'quantity' (répartition, ex. sponge cake).
 */
export function formatSupplementLabel(s: CartItemSupplement): string {
  return s.quantity && s.quantity > 1
    ? `${s.optionName} ×${s.quantity}`
    : s.optionName;
}

export type AggregatedSupplement = {
  groupName: string;
  optionName: string;
  /** Quantité totale de ce supplément sur tous les cartId fusionnés. */
  quantity: number;
};

export type AggregatedSupplementLine = {
  key: string;
  productName: string;
  /** Quantité totale du produit sur les cartId fusionnés. */
  quantity: number;
  supplements: AggregatedSupplement[];
};

/**
 * Regroupe les articles d'une commande ayant des suppléments par produit +
 * jeu de suppléments identique, en sommant les quantités. Nécessaire car
 * deux `cartId` distincts du même produit avec le même supplément (ex. 2
 * fondants ajoutés séparément) ne doivent jamais se lire comme une seule
 * unité en cuisine — d'où la quantité agrégée portée par le supplément
 * lui-même, pas seulement par le produit.
 */
export function aggregateOrderSupplements(
  items: CartItem[]
): AggregatedSupplementLine[] {
  const lines = new Map<string, AggregatedSupplementLine>();
  for (const item of items) {
    if (item.supplements.length === 0) continue;
    const supplementKey = item.supplements
      .map((s) => `${s.groupName}:${s.optionName}:${s.quantity ?? 1}`)
      .sort()
      .join('|');
    const key = `${item.productId}::${supplementKey}`;
    const existing = lines.get(key);
    if (existing) {
      existing.quantity += item.quantity;
      for (const s of item.supplements) {
        const target = existing.supplements.find(
          (x) => x.groupName === s.groupName && x.optionName === s.optionName
        );
        if (target) target.quantity += item.quantity * (s.quantity ?? 1);
      }
    } else {
      lines.set(key, {
        key,
        productName: item.productName,
        quantity: item.quantity,
        supplements: item.supplements.map((s) => ({
          groupName: s.groupName,
          optionName: s.optionName,
          quantity: item.quantity * (s.quantity ?? 1),
        })),
      });
    }
  }
  return [...lines.values()];
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
 * `readyAt` / `stockReservedAt` sont optionnels : toutes les files ne les
 * portent pas.
 */
export type RawOrderDates = {
  pickupTime: string | null;
  createdAt: string;
  preparingStartedAt?: string | null;
  readyAt?: string | null;
  stockReservedAt?: string | null;
};

/**
 * Convertit les champs date d'une commande SSE (`pickupTime`, `createdAt`,
 * et les optionnels `preparingStartedAt` / `readyAt` / `stockReservedAt`) en
 * objets `Date`.
 *
 * Pur, sans effet de bord — sûr côté serveur comme client. Conserve toutes
 * les autres clés inchangées via le spread, de sorte que le générique
 * passe par référence : tout type étendant `RawOrderDates` se retrouve avec
 * ces champs re-désérialisés en `Date` (ou `null`).
 */
export function normalizeOrderDates<T extends RawOrderDates>(
  raw: T
): Omit<
  T,
  | 'pickupTime'
  | 'createdAt'
  | 'preparingStartedAt'
  | 'readyAt'
  | 'stockReservedAt'
> & {
  pickupTime: Date | null;
  createdAt: Date;
  preparingStartedAt: Date | null;
  readyAt: Date | null;
  stockReservedAt: Date | null;
} {
  return {
    ...raw,
    pickupTime: raw.pickupTime ? new Date(raw.pickupTime) : null,
    createdAt: new Date(raw.createdAt),
    preparingStartedAt: raw.preparingStartedAt
      ? new Date(raw.preparingStartedAt)
      : null,
    readyAt: raw.readyAt ? new Date(raw.readyAt) : null,
    stockReservedAt: raw.stockReservedAt ? new Date(raw.stockReservedAt) : null,
  };
}
