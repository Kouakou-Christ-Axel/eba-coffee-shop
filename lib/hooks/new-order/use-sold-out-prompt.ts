'use client';

import { useState } from 'react';
import type { Product } from '@/config/menu';
import type { CartItemSupplement } from '@/lib/cart-store';
import { isProductSoldOut, productNeedsPicker } from '@/lib/catalog';

type Deps = {
  isDeferredDay: boolean;
  setPickupTime: (iso: string) => void;
  addToCart: (product: Product, supplements: CartItemSupplement[]) => void;
  openPicker: (product: Product) => void;
};

/**
 * Tap sur une tuile du catalogue. Ajoute directement sauf si le produit impose
 * un choix (`productNeedsPicker`, lib/catalog.ts). Sur « Maintenant », un
 * produit épuisé ouvre « pour quel jour ? » : le tap est rejoué après le choix.
 */
export function useSoldOutPrompt({
  isDeferredDay,
  setPickupTime,
  addToCart,
  openPicker,
}: Deps) {
  const [soldOutPrompt, setSoldOutPrompt] = useState<Product | null>(null);

  function handleProductTap(product: Product) {
    if (!isDeferredDay && isProductSoldOut(product)) {
      setSoldOutPrompt(product);
      return;
    }
    if (!productNeedsPicker(product)) {
      addToCart(product, []);
      return;
    }
    openPicker(product);
  }

  /** Jour choisi : TOUTE la commande bascule sur ce jour, puis le tap est rejoué. */
  function resolveSoldOutPrompt(iso: string) {
    const product = soldOutPrompt;
    setSoldOutPrompt(null);
    setPickupTime(iso);
    if (!product) return;
    if (!productNeedsPicker(product)) {
      addToCart(product, []);
      return;
    }
    openPicker(product);
  }

  return {
    soldOutPrompt,
    handleProductTap,
    resolveSoldOutPrompt,
    dismissSoldOutPrompt: () => setSoldOutPrompt(null),
    promptSoldOutDay: (product: Product) => setSoldOutPrompt(product),
  };
}
