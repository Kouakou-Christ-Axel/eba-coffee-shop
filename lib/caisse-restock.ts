'use client';

// lib/caisse-restock.ts
//
// Helpers CLIENT pour la réappro rapide depuis la caisse : appel de la route
// `/api/caisse/restock` et application locale du nouveau stock sur un objet
// menu (mise à jour « live » sans rechargement). Aucune logique métier ici —
// la source de vérité reste le serveur ; on ne fait que refléter la réponse.

import type { MenuCategory, Product, SupplementOption } from '@/config/menu';

// Référence d'une cible de stock (sans quantité) : produit, ou goût (option).
export type RestockRef =
  | { target: 'product'; productId: string }
  | {
      target: 'option';
      productId: string;
      groupName: string;
      optionName: string;
    };

// Corps de requête complet : la référence + la quantité à ajouter.
export type RestockBody = RestockRef & { delta: number };

export type RestockResult =
  | { ok: true; stockQuantity: number | null }
  | { ok: false; error: string };

/** Appelle la route de réappro caisse et renvoie le nouveau stock. */
export async function restockRequest(
  body: RestockBody
): Promise<RestockResult> {
  try {
    const res = await fetch('/api/caisse/restock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let msg = `Erreur ${res.status}`;
      try {
        const data = (await res.json()) as { error?: unknown };
        if (typeof data.error === 'string') msg = data.error;
      } catch {
        // corps non-JSON : on garde le message générique
      }
      return { ok: false, error: msg };
    }
    const data = (await res.json()) as { stockQuantity: number | null };
    return { ok: true, stockQuantity: data.stockQuantity ?? null };
  } catch {
    return { ok: false, error: 'Réseau indisponible' };
  }
}

/** Recalcule les champs dérivés (`remaining`, `soldOut`) depuis `stockQuantity`. */
function withDerivedStock<T extends SupplementOption | Product>(
  entity: T,
  stockQuantity: number | null
): T {
  return {
    ...entity,
    stockQuantity,
    remaining: stockQuantity,
    soldOut: stockQuantity === 0,
  };
}

/** Applique un nouveau stock d'option à un produit (immuable). */
export function applyOptionStock(
  product: Product,
  groupName: string,
  optionName: string,
  stockQuantity: number | null
): Product {
  return {
    ...product,
    supplements: (product.supplements ?? []).map((g) =>
      g.name !== groupName
        ? g
        : {
            ...g,
            options: g.options.map((o) =>
              o.name === optionName ? withDerivedStock(o, stockQuantity) : o
            ),
          }
    ),
  };
}

/** Applique un nouveau stock produit (immuable). */
export function applyProductStock(
  product: Product,
  stockQuantity: number | null
): Product {
  return withDerivedStock(product, stockQuantity);
}

/** Applique une réappro (produit ou option) sur le menu complet (immuable). */
export function applyRestockToMenu(
  menu: MenuCategory[],
  ref: RestockRef,
  stockQuantity: number | null
): MenuCategory[] {
  return menu.map((cat) => ({
    ...cat,
    products: cat.products.map((p) => {
      if (p.id !== ref.productId) return p;
      return ref.target === 'product'
        ? applyProductStock(p, stockQuantity)
        : applyOptionStock(p, ref.groupName, ref.optionName, stockQuantity);
    }),
  }));
}
