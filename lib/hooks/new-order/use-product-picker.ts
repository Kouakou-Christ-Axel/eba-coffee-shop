'use client';

import { useState } from 'react';
import type { Product } from '@/config/menu';
import type { CartItem } from '@/lib/cart-store';

/**
 * Modale de suppléments. `pickerCartId` non nul = pré-remplie depuis une ligne
 * existante pour AJOUTER un exemplaire aux suppléments différents (« Dupliquer »).
 */
export function useProductPicker(items: CartItem[]) {
  const [pickerProduct, setPickerProduct] = useState<Product | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerCartId, setPickerCartId] = useState<string | null>(null);

  /** Ouvre le sélecteur à la demande (bouton « Options » d'une tuile). */
  function openPicker(product: Product) {
    setPickerCartId(null);
    setPickerProduct(product);
    setIsPickerOpen(true);
  }

  function duplicateLineWithOptions(product: Product, cartId: string) {
    setPickerCartId(cartId);
    setPickerProduct(product);
    setIsPickerOpen(true);
  }

  const pickerInitialSupplements = pickerCartId
    ? (items.find((i) => i.cartId === pickerCartId)?.supplements ?? [])
    : [];

  function closePicker() {
    setIsPickerOpen(false);
    setPickerProduct(null);
    setPickerCartId(null);
  }

  return {
    pickerProduct,
    isPickerOpen,
    pickerCartId,
    pickerInitialSupplements,
    openPicker,
    duplicateLineWithOptions,
    closePicker,
  };
}
