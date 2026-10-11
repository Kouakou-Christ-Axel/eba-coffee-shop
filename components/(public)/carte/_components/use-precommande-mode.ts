// components/(public)/carte/_components/use-precommande-mode.ts
//
// État précommande du panier + réinitialisation du créneau à la transition
// descendante (dernier article épuisé retiré) — extrait de checkout-form.tsx
// pour ne pas alourdir son orchestration déjà dense.

import { useEffect, useRef } from 'react';
import type { CartItem } from '@/lib/cart-store';
import { isPrecommandeCart } from '@/lib/cart-precommande';
import type { UseCheckoutFormResult } from '@/lib/hooks/checkout-form/types';

type UsePrecommandeModeResult = {
  /** Un article épuisé aujourd'hui mérite un message dédié : « commande à
   * l'avance » serait faux, ce n'est pas une règle du produit mais un état
   * du jour. */
  soldOutRestricted: boolean;
  /** Contrainte de jour venant UNIQUEMENT d'une rupture (pas d'un
   * `advanceOrderDays` générique > 1 cumulé) : fige le SlotPicker sur
   * demain, sans sélecteur de jour. */
  precommandePure: boolean;
};

export function usePrecommandeMode(
  items: CartItem[],
  minAdvanceOrderDays: number,
  setField: UseCheckoutFormResult['setField']
): UsePrecommandeModeResult {
  const soldOutRestricted = isPrecommandeCart(items);
  const precommandePure = soldOutRestricted && minAdvanceOrderDays === 1;

  // Dernier article épuisé retiré du panier (mode précommande → normal) : un
  // créneau « demain » resté coché n'a plus lieu d'être — on le réinitialise
  // pour laisser réapparaître « Dès que possible ». Ne se déclenche QU'À la
  // transition descendante (ref), jamais à chaque rendu où `soldOutRestricted`
  // est déjà faux.
  const wasPrecommande = useRef(soldOutRestricted);
  useEffect(() => {
    if (!soldOutRestricted && wasPrecommande.current) {
      setField('timing', 'asap');
      setField('pickupTime', null);
    }
    wasPrecommande.current = soldOutRestricted;
  }, [soldOutRestricted, setField]);

  return { soldOutRestricted, precommandePure };
}
