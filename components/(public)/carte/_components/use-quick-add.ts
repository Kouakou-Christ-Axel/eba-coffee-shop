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
import { isPausedNow } from '@/lib/supplements';
import { LOW_STOCK_THRESHOLD } from '@/config/constants';
import type { Product } from '@/config/menu';

/** Durée de l'accusé de réception visuel (✓) après un ajout direct. */
const ADDED_FEEDBACK_MS = 1200;

export function useQuickAdd(product: Product) {
  const addItem = useCartStore((s) => s.addItem);
  const [isModalOpen, setModalOpen] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  const hasOptions = (product.supplements?.length ?? 0) > 0;

  // Priorité d'affichage : pause > épuisé > stock bas > rien (illimité/stock
  // confortable). Pause et épuisé désactivent l'ajout ; stock bas reste une
  // simple info (le prochain « Épuisé » viendra tout seul à 0).
  const paused = isPausedNow(product.unavailableUntil);
  const soldOut = !paused && product.soldOut === true;
  const lowStock =
    !paused &&
    !soldOut &&
    product.remaining != null &&
    product.remaining > 0 &&
    product.remaining <= LOW_STOCK_THRESHOLD;
  const isUnorderable = paused || soldOut;

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
        },
        product.remaining ?? undefined
      );
    }
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
    lowStock,
    isUnorderable,
    justAdded,
    isModalOpen,
    closeModal: () => setModalOpen(false),
    handleAdd,
  };
}
