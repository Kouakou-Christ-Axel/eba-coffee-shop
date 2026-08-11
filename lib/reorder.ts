// lib/reorder.ts
//
// « Recommander ma dernière commande » : transforme les articles d'une commande
// passée en lignes de panier valides AUJOURD'HUI.
//
// Une commande archivée est un instantané : ses prix, ses produits et ses
// options peuvent avoir changé depuis. On ne réinjecte donc jamais l'article
// tel quel — chaque ligne est ré-appariée au menu courant et re-tarifée depuis
// lui. Ce qui n'existe plus, ou n'est plus commandable, est écarté et signalé
// au client plutôt que glissé silencieusement dans son panier.
//
// Pur (ni React, ni Prisma, ni fetch) : le composant appelant se charge d'aller
// chercher la commande et d'alimenter le store.

import type { CartItem, CartItemSupplement } from '@/lib/cart-store';
import type { MenuCategory, Product, SupplementGroup } from '@/config/menu';
import { isOrderableNow } from '@/lib/supplements';

/** Ligne prête pour `useCartStore().addItem`, avec sa quantité et son plafond. */
export type ReorderLine = {
  item: Omit<CartItem, 'cartId' | 'quantity'>;
  quantity: number;
  /** Stock restant du produit (`null` = illimité), plafond de `addItem`. */
  maxQuantity: number | null;
};

export type SkippedLine = {
  name: string;
  reason: 'introuvable' | 'indisponible';
};

export type ReorderPlan = {
  addable: ReorderLine[];
  skipped: SkippedLine[];
};

function indexProducts(menu: MenuCategory[]): Map<string, Product> {
  const index = new Map<string, Product>();
  menu.forEach((category) =>
    category.products.forEach((p) => index.set(p.id, p))
  );
  return index;
}

/**
 * Ne conserve que les suppléments dont le groupE ET l'option existent encore,
 * et re-tarife depuis l'option courante. Une option supprimée au dashboard
 * laisserait sinon une ligne fantôme que la cuisine ne saurait pas préparer.
 */
function reconcileSupplements(
  supplements: CartItemSupplement[],
  groups: SupplementGroup[]
): CartItemSupplement[] {
  return supplements.flatMap((chosen) => {
    const group = groups.find((g) => g.name === chosen.groupName);
    const option = group?.options.find((o) => o.name === chosen.optionName);
    if (!group || !option || option.soldOut === true) return [];
    return [
      {
        groupName: group.name,
        optionName: option.name,
        price: option.price,
        ...(chosen.quantity != null ? { quantity: chosen.quantity } : {}),
      },
    ];
  });
}

export function buildReorderPlan(
  items: CartItem[],
  menu: MenuCategory[],
  now: Date = new Date()
): ReorderPlan {
  const index = indexProducts(menu);
  const addable: ReorderLine[] = [];
  const skipped: SkippedLine[] = [];

  items.forEach((item) => {
    const product = index.get(item.productId);
    if (!product) {
      skipped.push({ name: item.productName, reason: 'introuvable' });
      return;
    }
    if (!isOrderableNow(product, now)) {
      skipped.push({ name: product.name, reason: 'indisponible' });
      return;
    }

    addable.push({
      // Tout vient du MENU COURANT, jamais de la commande archivée : nom, prix,
      // coûts et snapshots de disponibilité. Seules la quantité et les options
      // choisies proviennent de la commande.
      item: {
        productId: product.id,
        productName: product.name,
        basePrice: product.price,
        coutMatiere: product.coutMatiere ?? 0,
        coutEmballage: product.coutEmballage ?? 0,
        supplements: reconcileSupplements(
          item.supplements ?? [],
          product.supplements ?? []
        ),
        advanceOrderDays: product.advanceOrderDays,
        availableDays: product.availableDays,
        weeklySpecialPeriods: product.weeklySpecialPeriods,
      },
      quantity: Math.max(1, item.quantity),
      maxQuantity: product.remaining ?? null,
    });
  });

  return { addable, skipped };
}

/** « 3 articles ajoutés · 1 indisponible aujourd'hui ». */
export function formatReorderOutcomeLabel(plan: ReorderPlan): string {
  const added = plan.addable.reduce((sum, l) => sum + l.quantity, 0);
  const parts = [
    added === 0
      ? 'Aucun article ajouté'
      : `${added} article${added > 1 ? 's' : ''} ajouté${added > 1 ? 's' : ''}`,
  ];
  if (plan.skipped.length > 0) {
    parts.push(
      `${plan.skipped.length} indisponible${plan.skipped.length > 1 ? 's' : ''} aujourd'hui`
    );
  }
  return parts.join(' · ');
}
