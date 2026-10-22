// Réservations de stock par ressource — état d'une commande pour les écrans.
//
// Pour une programmée payée du jour pas encore lancée : ce qui est déjà réservé,
// ce qui attend, et ce que le stock ne couvre pas. Alimente la file cuisine, la
// file caisse et la page de suivi — qui, sans ça, verraient « indisponible » un
// produit dont la commande a déjà pris sa part (le stock réservé est déjà sorti).

import prisma from '@/lib/prisma';
import type { CartItem } from '@/lib/cart-store';
import type { ItemAvailability } from '@/lib/orders/availability-core';
import { resolveOptionId } from '@/lib/orders/mutations/stock-needs';
import { endOfLocalDay, startOfLocalDay } from '@/lib/timezone';
import { loadHoldsForOrders, readStockByKeys } from './holds';
import { holdKey, type HoldMap } from './keys';

/** Résumé sérialisable (flux SSE) de l'état de réservation d'une commande. */
export type StockHoldSummary = {
  /** `full` : tout est réservé, la commande est prête à lancer. */
  state: 'full' | 'partial' | 'none';
  /** Ressources réservées / ressources à réserver (illimitées exclues). */
  reserved: number;
  total: number;
  /** Libellés de ce qui attend encore sa réservation (« Sponge cake (Vanille) »). */
  waiting: string[];
};

export type StockHoldDetail = StockHoldSummary & {
  /** Disponibilité par ligne : réservé + stock restant face au besoin. */
  availability: { items: ItemAvailability[]; fulfillable: boolean };
};

export type HoldCandidate = {
  status: string;
  isPaid: boolean;
  stockReservedAt: Date | null;
  pickupTime: Date | null;
};

/** Même périmètre que `reserveForScheduledOrders` : payée, pas lancée, retrait aujourd'hui. */
export function isHoldCandidate(o: HoldCandidate, now: Date): boolean {
  return (
    o.status === 'NEW' &&
    o.isPaid &&
    o.stockReservedAt === null &&
    o.pickupTime !== null &&
    o.pickupTime >= startOfLocalDay(now) &&
    o.pickupTime <= endOfLocalDay(now)
  );
}

type Resource = { key: string; needed: number; label: string };

async function itemResources(items: CartItem[]) {
  const perItem = new Map<
    string,
    { item: CartItem; keys: { key: string; optionName?: string }[] }
  >();
  const resources = new Map<string, Resource>();
  const add = (key: string, needed: number, label: string) => {
    const cur = resources.get(key);
    resources.set(key, {
      key,
      needed: (cur?.needed ?? 0) + needed,
      label: cur?.label ?? label,
    });
  };
  for (const item of items) {
    const keys: { key: string; optionName?: string }[] = [];
    const productKey = holdKey('PRODUCT', item.productId);
    add(productKey, item.quantity, item.productName);
    keys.push({ key: productKey });
    for (const s of item.supplements) {
      const optionId = await resolveOptionId(
        prisma,
        item.productId,
        s.groupName,
        s.optionName
      );
      // Option introuvable : traitée comme manquante (cas limite sûr, comme `computeOrderItemsAvailability`).
      const key = optionId
        ? holdKey('OPTION', optionId)
        : `MISSING:${item.productId}:${s.groupName}:${s.optionName}`;
      add(
        key,
        (s.quantity ?? 1) * item.quantity,
        `${item.productName} (${s.optionName})`
      );
      keys.push({ key, optionName: s.optionName });
    }
    perItem.set(item.cartId, { item, keys });
  }
  return { perItem, resources };
}

/**
 * État de réservation de chaque commande, calculé en lot (stock lu une seule fois).
 * À n'appeler que pour des commandes `isHoldCandidate`.
 */
export async function summarizeStockHolds(
  orders: { id: string; items: CartItem[] }[]
): Promise<Map<string, StockHoldDetail>> {
  const out = new Map<string, StockHoldDetail>();
  if (orders.length === 0) return out;

  const holds = await loadHoldsForOrders(
    prisma,
    orders.map((o) => o.id)
  );
  const resolved = await Promise.all(orders.map((o) => itemResources(o.items)));

  const allKeys = new Set<string>();
  for (const r of resolved) {
    for (const key of r.resources.keys()) allKeys.add(key);
  }
  const stock = await readStockByKeys(prisma, [...allKeys]);

  orders.forEach((order, i) => {
    const { perItem, resources } = resolved[i];
    const held: HoldMap = holds.get(order.id) ?? new Map();

    let reserved = 0;
    let total = 0;
    const waiting: string[] = [];
    const short = new Set<string>();
    for (const r of resources.values()) {
      const have = stock.get(r.key);
      const isUnlimited = have === null;
      const heldQty = held.get(r.key) ?? 0;
      if (!isUnlimited) {
        total++;
        if (heldQty >= r.needed) reserved++;
        else waiting.push(r.label);
      }
      // Couvert = déjà réservé + stock restant ; absent de la base = manquant.
      const covered =
        isUnlimited || (have !== undefined && heldQty + have >= r.needed);
      if (!covered) short.add(r.key);
    }

    const items: ItemAvailability[] = [...perItem.entries()].map(
      ([cartId, { keys }]) => {
        const missingProduct = keys.some(
          (k) => !k.optionName && short.has(k.key)
        );
        const missingOptionNames = keys
          .filter((k) => k.optionName && short.has(k.key))
          .map((k) => k.optionName as string);
        return {
          cartId,
          available: !missingProduct && missingOptionNames.length === 0,
          missingProduct,
          missingOptionNames,
        };
      }
    );

    out.set(order.id, {
      state: reserved === total ? 'full' : reserved > 0 ? 'partial' : 'none',
      reserved,
      total,
      waiting,
      availability: {
        items,
        fulfillable: items.every((a) => a.available),
      },
    });
  });
  return out;
}

/** Retire le détail par ligne : seul le résumé voyage dans les flux SSE. */
export function toSummary(detail: StockHoldDetail): StockHoldSummary {
  const { state, reserved, total, waiting } = detail;
  return { state, reserved, total, waiting };
}
