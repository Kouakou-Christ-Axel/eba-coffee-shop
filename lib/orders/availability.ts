// lib/orders/availability.ts
//
// Disponibilité courante des lignes d'une commande DONT LE STOCK N'EST PAS
// ENCORE RÉSERVÉ (`Order.stockReservedAt === null`), face au stock actuel
// (`Product.stockQuantity` / `SupplementOption.stockQuantity`).
// Partagé par la page de suivi client (`getPublicOrder`, lib/orders.ts) et la
// file caisse (`fetchCashierQueue`, lib/cashier-queue.ts) pour éviter toute
// divergence entre les deux signaux « stock épuisé ». Une commande déjà entrée
// en cuisine n'a pas besoin de ce calcul : son stock y a été réservé — et ce,
// qu'elle soit payée ou non (une ardoise part en cuisine sans encaissement).
//
// `null` = illimité (toujours disponible) ; entier comparé à la quantité
// nécessaire pour CETTE ligne (`item.quantity`, `supplement.quantity ?? 1`
// × `item.quantity`).

import prisma from '@/lib/prisma';
import type { CartItem } from '@/lib/cart-store';
import { intersectAvailableDays } from '@/lib/menu';
import {
  isAvailableToday,
  isPreorderable,
  isWithinAnyPeriod,
} from '@/lib/supplements';
import { formatLocalDateOnly } from '@/lib/timezone';
import {
  optionKey,
  type OptionStockMap,
  type ProductStockMap,
  type StockSnapshot,
} from './availability-core';

export {
  optionKey,
  computeOrderItemsAvailability,
  buildSoldOutLines,
  type StockSnapshot,
  type ItemAvailability,
} from './availability-core';

/**
 * Récupère en un lot le stock courant des produits et options référencés par
 * `itemsList` (un tableau de tableaux d'articles — une entrée par commande,
 * ou un seul tableau pour une commande unique). Une seule requête, quel que
 * soit le nombre de commandes/lignes en entrée (pas de N+1).
 */
export async function fetchStockSnapshot(
  itemsList: CartItem[][]
): Promise<StockSnapshot> {
  const productIds = new Set<string>();
  for (const items of itemsList) {
    for (const item of items) productIds.add(item.productId);
  }

  const products: ProductStockMap = new Map();
  const options: OptionStockMap = new Map();
  if (productIds.size === 0) {
    return { products, options };
  }

  const [rows, globalGroups] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: [...productIds] } },
      select: {
        id: true,
        stockQuantity: true,
        supplementGroups: {
          select: {
            name: true,
            // `available: true` : deux options peuvent partager un nom dans un
            // même groupe (renommage, ancien « goût » désactivé conservé) — ne
            // garder que l'option réellement proposée au client évite qu'une
            // ligne désactivée n'écrase la disponibilité de la bonne option
            // dans la map ci-dessous (cf. même garde dans
            // `decrementStockForOrderItems`, lib/order-mutations.ts).
            options: {
              where: { available: true },
              select: { name: true, stockQuantity: true },
            },
          },
        },
      },
    }),
    // Groupes globaux (« Extras ») : pas rattachés à un produit (`productId`
    // null), donc absents de la relation ci-dessus — s'appliquent à TOUS les
    // produits référencés, on les fusionne ci-dessous pour chacun.
    prisma.supplementGroup.findMany({
      where: { isGlobal: true },
      select: {
        name: true,
        options: {
          where: { available: true },
          select: { name: true, stockQuantity: true },
        },
      },
    }),
  ]);

  for (const p of rows) {
    products.set(p.id, p.stockQuantity);
    for (const g of p.supplementGroups) {
      for (const o of g.options) {
        options.set(optionKey(p.id, g.name, o.name), o.stockQuantity);
      }
    }
    for (const g of globalGroups) {
      for (const o of g.options) {
        options.set(optionKey(p.id, g.name, o.name), o.stockQuantity);
      }
    }
  }

  return { products, options };
}

// ─── Commande à l'avance obligatoire ───────────────────────────────────────
//
// `Product.advanceOrderDays`/`MenuCategory.advanceOrderDays` (voir
// prisma/schema.prisma) : délai MINIMUM (jours civils) entre la commande et
// le retrait, combiné par MAXIMUM entre produit et catégorie (voir
// `effectiveAdvanceOrderDays`, lib/menu.ts). Contrôlé côté serveur UNIQUEMENT
// pour le flux public (`createOrder`, lib/orders.ts) — la caisse
// (`createCashierOrder`, lib/order-mutations.ts) n'est volontairement pas
// bloquée, le personnel garde la main sur les exceptions.

export type AdvanceOrderMap = Map<string, number | null>;

/**
 * Instantané (produit → délai EFFECTIF) pour les produits référencés par
 * `items`. Une seule requête, pas de N+1.
 */
export async function fetchAdvanceOrderSnapshot(
  items: CartItem[]
): Promise<AdvanceOrderMap> {
  const productIds = [...new Set(items.map((i) => i.productId))];
  const map: AdvanceOrderMap = new Map();
  if (productIds.length === 0) return map;

  const rows = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      advanceOrderDays: true,
      category: { select: { advanceOrderDays: true } },
    },
  });
  for (const p of rows) {
    map.set(
      p.id,
      p.advanceOrderDays == null && p.category.advanceOrderDays == null
        ? null
        : Math.max(p.advanceOrderDays ?? 0, p.category.advanceOrderDays ?? 0)
    );
  }
  return map;
}

/** Plus grand délai de commande à l'avance requis parmi `items`, ou 0 si
 * aucune ligne n'a de contrainte (produit supprimé entre-temps = 0, cas
 * limite sûr — l'absence de la ligne du panier n'est pas le problème ici). */
export function maxRequiredAdvanceOrderDays(
  items: CartItem[],
  snapshot: AdvanceOrderMap
): number {
  return items.reduce(
    (max, i) => Math.max(max, snapshot.get(i.productId) ?? 0),
    0
  );
}

// ─── Précommande interdite ─────────────────────────────────────────────────
//
// `Product.preorderable = false` : le produit ne se retire que le jour même.
// Même asymétrie que ci-dessus : contrôlé pour le flux public uniquement, la
// caisse garde la main. Un délai `advanceOrderDays` (produit ou catégorie)
// l'emporte, voir `isPreorderable`.

/**
 * Noms des produits de `items` qui refusent la précommande, relus en base
 * (jamais depuis le snapshot du panier). Une seule requête, pas de N+1 ; vide
 * si tout se précommande.
 */
export async function findNonPreorderableNames(
  items: CartItem[]
): Promise<string[]> {
  const productIds = [...new Set(items.map((i) => i.productId))];
  if (productIds.length === 0) return [];

  const rows = await prisma.product.findMany({
    where: { id: { in: productIds }, preorderable: false },
    select: {
      name: true,
      advanceOrderDays: true,
      category: { select: { advanceOrderDays: true } },
    },
  });
  return rows
    .filter(
      (p) =>
        !isPreorderable({
          preorderable: false,
          advanceOrderDays: Math.max(
            p.advanceOrderDays ?? 0,
            p.category.advanceOrderDays ?? 0
          ),
        })
    )
    .map((p) => p.name);
}

// ─── Planning récurrent / « spécialité de la semaine » obligatoires ───────
//
// `Product.availableDays` (via `ProductSchedule`, intersecté avec celui de
// la catégorie — voir `intersectAvailableDays`, lib/menu.ts) et
// `Product.weeklySpecialPeriods` (via `ProductWeeklySpecial`, fenêtres de
// dates) : un produit gated par l'un ou l'autre n'est commandable qu'aux
// dates qui les respectent. Contrôlé côté serveur UNIQUEMENT pour le flux
// public (`createOrder`, lib/orders.ts), même asymétrie voulue que
// `advanceOrderDays` ci-dessus — la caisse garde la main.

export type ProductScheduleEntry = {
  availableDays: number[] | null;
  weeklySpecialPeriods: { startDate: string; endDate: string }[];
};
export type ScheduleMap = Map<string, ProductScheduleEntry>;

/**
 * Instantané (produit → planning EFFECTIF) pour les produits référencés par
 * `items`. Une seule requête, pas de N+1 — même forme que
 * `fetchAdvanceOrderSnapshot`, jamais dérivé du snapshot envoyé par le
 * client (`CartItem.availableDays`/`weeklySpecialPeriods`, purement UX).
 */
export async function fetchScheduleSnapshot(
  items: CartItem[]
): Promise<ScheduleMap> {
  const productIds = [...new Set(items.map((i) => i.productId))];
  const map: ScheduleMap = new Map();
  if (productIds.length === 0) return map;

  const rows = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      schedule: { select: { days: true } },
      category: { select: { schedule: { select: { days: true } } } },
      weeklySpecials: { select: { startDate: true, endDate: true } },
    },
  });
  for (const p of rows) {
    map.set(p.id, {
      availableDays: intersectAvailableDays(
        p.schedule?.days ?? null,
        p.category.schedule?.days ?? null
      ),
      weeklySpecialPeriods: p.weeklySpecials.map((w) => ({
        startDate: formatLocalDateOnly(w.startDate),
        endDate: formatLocalDateOnly(w.endDate),
      })),
    });
  }
  return map;
}

/**
 * Premier article de `items` dont le planning/la fenêtre « spécialité »
 * exclut `pickupDate` (ou maintenant, si `pickupDate` est absent — « dès que
 * possible »), ou `null` si tous les articles y sont disponibles. Un produit
 * absent de l'instantané (supprimé entre-temps) n'est pas bloqué ici — ce
 * n'est pas ce contrôle qui doit signaler ce cas.
 */
export function findScheduleBlockedItem(
  items: CartItem[],
  snapshot: ScheduleMap,
  pickupDate: Date | string | null | undefined,
  now: Date = new Date()
): CartItem | null {
  const target = pickupDate
    ? typeof pickupDate === 'string'
      ? new Date(pickupDate)
      : pickupDate
    : now;
  return (
    items.find((item) => {
      const entry = snapshot.get(item.productId);
      if (!entry) return false;
      return (
        !isAvailableToday(entry.availableDays, target) ||
        !isWithinAnyPeriod(entry.weeklySpecialPeriods, target)
      );
    }) ?? null
  );
}
