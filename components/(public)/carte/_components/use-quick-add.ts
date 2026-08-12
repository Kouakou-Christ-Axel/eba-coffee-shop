'use client';

// components/(public)/carte/_components/use-quick-add.ts
//
// Geste d'ajout au panier, partagé par les trois endroits qui le proposent :
// la ligne produit, la vitrine « Les plus commandés » et la vente additionnelle
// du panier. Une seule implémentation pour une seule règle métier — un produit
// à options ouvre la modale, les autres tombent directement dans le panier, et
// un produit en pause ou épuisé ne part jamais.

import { useState } from 'react';
import { useCartStore } from '@/lib/cart-store';
import {
  isPausedNow,
  isAvailableToday,
  isOrderableNow,
  isWithinAnyPeriod,
} from '@/lib/supplements';
import { LOW_STOCK_THRESHOLD } from '@/config/constants';
import { trackAddToCart } from '@/lib/analytics';
import type { Product } from '@/config/menu';

/** Durée de l'accusé de réception visuel (✓) après un ajout direct. */
const ADDED_FEEDBACK_MS = 1200;

export function useQuickAdd(product: Product) {
  const addItem = useCartStore((s) => s.addItem);
  const [isModalOpen, setModalOpen] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  const hasOptions = (product.supplements?.length ?? 0) > 0;

  // Priorité d'affichage : pause > épuisé > hors « spécialité de la semaine »
  // > hors planning récurrent > stock bas > rien (illimité/stock confortable).
  // Pause, épuisé et hors planning/fenêtre désactivent l'ajout ; stock bas
  // reste une simple info (le prochain « Épuisé » viendra tout seul à 0).
  const paused = isPausedNow(product.unavailableUntil);
  const soldOut = !paused && product.soldOut === true;
  const weeklyGated =
    !paused && !soldOut && !isWithinAnyPeriod(product.weeklySpecialPeriods);
  const outOfSchedule =
    !paused &&
    !soldOut &&
    !weeklyGated &&
    !isAvailableToday(product.availableDays);
  const lowStock =
    !paused &&
    !soldOut &&
    !weeklyGated &&
    !outOfSchedule &&
    product.remaining != null &&
    product.remaining > 0 &&
    product.remaining <= LOW_STOCK_THRESHOLD;
  // Les drapeaux ci-dessus restent nécessaires aux LIBELLÉS (chacun a son
  // message) ; la décision « peut-on ajouter ? » se lit, elle, à la source
  // partagée avec les vitrines qui filtrent leur sélection.
  const isUnorderable = !isOrderableNow(product);

  /**
   * Ajoute `quantity` exemplaires SANS supplément. Le store plafonne lui-même
   * sur le stock restant et fusionne les lignes identiques : on peut donc
   * appeler `addItem` en boucle sans dupliquer sa logique de garde-fou.
   */
  function addDirect(quantity = 1) {
    for (let i = 0; i < quantity; i++) {
      addItem(
        {
          productId: product.id,
          productName: product.name,
          basePrice: product.price,
          coutMatiere: product.coutMatiere ?? 0,
          coutEmballage: product.coutEmballage ?? 0,
          supplements: [],
          advanceOrderDays: product.advanceOrderDays,
          availableDays: product.availableDays,
          weeklySpecialPeriods: product.weeklySpecialPeriods,
        },
        product.remaining ?? undefined
      );
    }
    // UN seul événement pour le geste, avec la quantité — pas un par tour de
    // boucle, sinon GA4 compte N ajouts distincts pour un seul clic.
    // Pas d'`item_category` : `Product` ne porte pas sa catégorie et les
    // vitrines l'ont déjà aplatie (voir featured-showcase.tsx).
    trackAddToCart([
      {
        item_id: product.id,
        item_name: product.name,
        price: product.price,
        quantity,
      },
    ]);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), ADDED_FEEDBACK_MS);
  }

  /** Point d'entrée du bouton « + » : modale si le produit a des options. */
  function handleAdd() {
    if (isUnorderable) return;
    if (hasOptions) setModalOpen(true);
    else addDirect();
  }

  return {
    hasOptions,
    paused,
    soldOut,
    weeklyGated,
    outOfSchedule,
    lowStock,
    isUnorderable,
    justAdded,
    isModalOpen,
    closeModal: () => setModalOpen(false),
    handleAdd,
  };
}
