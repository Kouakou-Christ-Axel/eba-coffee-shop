// lib/cart-availability.ts
//
// Revérification du panier contre le menu frais (`/api/menu`), AVANT que le
// client ne clique sur « Confirmer ». Le panier ne porte qu'un instantané pris
// à l'ajout ; entre-temps un produit a pu s'épuiser, être mis en pause… Sans
// ce contrôle, le client ne le découvrait qu'au 409 du serveur.
//
// Pur (aucun accès réseau/DOM/store) : la même règle ligne à ligne que le
// serveur (`computeOrderItemsAvailability`, lib/orders/availability-core.ts).
// Le serveur reste la vérité — le menu peut avoir jusqu'à une minute de retard
// (`revalidate = 60` sur `/api/menu`), et le 409 sait toujours se rattraper.

import type { CartItem, CartItemDraft } from '@/lib/cart-store';
import type { MenuCategory, Product } from '@/config/menu';
import type { SoldOutLine } from '@/lib/schemas/order';
import { canOrderForLaterDay } from '@/lib/supplements';
import { LOW_STOCK_THRESHOLD } from '@/config/constants';
import {
  buildSoldOutLines,
  computeOrderItemsAvailability,
  stockSnapshotFromMenu,
} from '@/lib/orders/availability-core';

/** État d'une ligne du panier, pour son libellé (chip). */
export type CartLineStatus =
  | { kind: 'ok' }
  /** Disponible, mais il en reste peu : incitation, pas un problème. */
  | { kind: 'low'; remaining: number }
  /** Épuisé aujourd'hui (ou stock inférieur à la quantité demandée). */
  | { kind: 'soldOut'; remaining: number | null }
  /** Le produit est là, mais un goût/une option choisi(e) manque. */
  | { kind: 'optionSoldOut'; names: string[] }
  /** Plus commandable du tout (retiré de la carte, en pause, hors planning) :
   * ni aujourd'hui ni demain — la ligne doit être retirée. */
  | { kind: 'gone' }
  /** Déjà prévu pour un autre jour (`soldOutToday`) : rien à résoudre. */
  | { kind: 'deferred' };

export type CartAvailability = {
  status: Record<string, CartLineStatus>;
  /** Lignes à résoudre, au format du 409 `SOLD_OUT_TODAY` : alimentent
   * directement le panneau « Résoudre » (`sold-out-resolver.tsx`). */
  soldOutLines: SoldOutLine[];
  /** Lignes plus commandables du tout (bloquent la commande). */
  goneCartIds: string[];
  /** Corrections à appliquer au panier : une ligne marquée « pour demain »
   * dont l'article est revenu en stock redevient commandable aujourd'hui. */
  patches: Record<string, Partial<CartItemDraft>>;
};

export function checkCartAgainstMenu(
  items: CartItem[],
  menu: MenuCategory[],
  now: Date = new Date()
): CartAvailability {
  const products = new Map<string, Product>(
    menu.flatMap((c) => c.products).map((p) => [p.id, p])
  );
  const stock = stockSnapshotFromMenu(menu);
  const availability = computeOrderItemsAvailability(items, stock).items;
  const byCartId = new Map(availability.map((a) => [a.cartId, a]));

  const status: CartAvailability['status'] = {};
  const patches: CartAvailability['patches'] = {};
  const goneCartIds: string[] = [];
  const toResolve: CartItem[] = [];

  for (const item of items) {
    const product = products.get(item.productId);
    if (!product || !canOrderForLaterDay(product, now)) {
      status[item.cartId] = { kind: 'gone' };
      goneCartIds.push(item.cartId);
      continue;
    }

    const a = byCartId.get(item.cartId)!;
    if (item.soldOutToday) {
      if (!a.available) {
        status[item.cartId] = { kind: 'deferred' };
        continue;
      }
      // De retour en stock : la contrainte « à partir de demain » tombe.
      patches[item.cartId] = { soldOutToday: undefined };
    }

    if (!a.available) {
      toResolve.push(item);
      status[item.cartId] = a.missingProduct
        ? { kind: 'soldOut', remaining: product.remaining ?? null }
        : { kind: 'optionSoldOut', names: a.missingOptionNames };
      continue;
    }

    const remaining = product.remaining;
    status[item.cartId] =
      remaining != null && remaining <= LOW_STOCK_THRESHOLD
        ? { kind: 'low', remaining }
        : { kind: 'ok' };
  }

  return {
    status,
    soldOutLines: buildSoldOutLines(toResolve, availability, stock),
    goneCartIds,
    patches,
  };
}

/** Libellé court d'une ligne à problème, ou `null` si rien à signaler. */
export function cartLineStatusLabel(s: CartLineStatus | undefined): {
  label: string;
  color: 'warning' | 'danger' | 'primary';
} | null {
  switch (s?.kind) {
    case 'low':
      return { label: `Plus que ${s.remaining}`, color: 'primary' };
    case 'soldOut':
      return s.remaining != null && s.remaining > 0
        ? { label: `Il n’en reste que ${s.remaining}`, color: 'warning' }
        : { label: 'Épuisé aujourd’hui', color: 'warning' };
    case 'optionSoldOut':
      return {
        label: `${s.names.join(', ')} épuisé${s.names.length > 1 ? 's' : ''}`,
        color: 'warning',
      };
    case 'gone':
      return { label: 'Plus disponible', color: 'danger' };
    case 'deferred':
      return { label: 'Retrait à partir de demain', color: 'warning' };
    default:
      return null;
  }
}
