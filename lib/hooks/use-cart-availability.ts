'use client';

// lib/hooks/use-cart-availability.ts
//
// Revérifie le panier contre un menu frais (voir `checkCartAgainstMenu`,
// lib/cart-availability.ts) et applique les corrections sûres au store — une
// ligne « pour demain » revenue en stock redevient commandable aujourd'hui.
// Le menu est fourni par l'appelant (le tiroir le charge déjà pour ses
// suppléments ; la page de commande le charge au montage) : ce hook ne fait
// aucune requête.

import { useEffect, useMemo } from 'react';
import { useCartStore } from '@/lib/cart-store';
import {
  checkCartAgainstMenu,
  type CartAvailability,
} from '@/lib/cart-availability';
import type { MenuCategory } from '@/config/menu';

/** `null` tant que le menu n'est pas chargé (ou s'il a échoué : sans menu,
 * on ne signale rien — le serveur reste la vérité). */
export function useCartAvailability(
  menu: MenuCategory[] | null
): CartAvailability | null {
  const items = useCartStore((s) => s.items);
  const patchItems = useCartStore((s) => s.patchItems);

  const result = useMemo(
    () => (menu && menu.length > 0 ? checkCartAgainstMenu(items, menu) : null),
    [items, menu]
  );

  // Pas de boucle : une fois le patch appliqué, le recalcul n'en produit plus.
  useEffect(() => {
    if (result && Object.keys(result.patches).length > 0) {
      patchItems(result.patches);
    }
  }, [result, patchItems]);

  return result;
}
