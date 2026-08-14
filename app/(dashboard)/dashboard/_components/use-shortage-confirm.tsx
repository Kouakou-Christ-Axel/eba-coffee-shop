'use client';

// Confirmation « il manque N × X — vous les avez produits ? », partagée par la
// CAISSE et la CUISINE.
//
// Pourquoi ce hook existe : le stock manquant renvoyait jusqu'ici un mur. En
// caisse, un dialogue proposait « Proposer un autre produit au client avant de
// payer », puis laissait continuer vers un 409 — un cul-de-sac. En cuisine, il
// n'y avait rien du tout : il fallait ouvrir /dashboard/menu, corriger la
// quantité, revenir, relancer. Or dans les deux cas la personne devant l'écran
// SAIT si la marchandise existe : elle vient de la produire.
//
// On lui pose donc la question, chiffrée, et sa réponse enregistre la
// production : le serveur crédite exactement le manquant puis la réservation le
// redescend (effet net nul, cf. `coverShortageForOrderItems`,
// lib/order-mutations.ts). Personne ne quitte son écran.
//
// Bâti sur `useConfirmDialog` plutôt qu'une modale de plus : même rendu, même
// ergonomie tactile, et une seule implémentation de confirmation dans le
// dashboard.

import { useCallback } from 'react';
import { useConfirmDialog } from './use-confirm-dialog';
import { formatShortageList } from '@/lib/orders/shortage';
import type { ShortageLine } from '@/lib/orders/shortage';

export function useShortageConfirm() {
  const { confirm, confirmDialog } = useConfirmDialog();

  /**
   * Renvoie `true` si le staff confirme avoir produit la quantité manquante —
   * l'appelant relance alors sa mutation avec `coverShortage: true`.
   *
   * Une liste vide renvoie `false` : la 409 ne vient pas d'une pénurie
   * couvrable (option supprimée, renommée…), il n'y a rien à proposer.
   */
  const confirmShortage = useCallback(
    async (shortage: ShortageLine[] | undefined): Promise<boolean> => {
      if (!shortage || shortage.length === 0) return false;
      return confirm({
        title: 'Stock insuffisant',
        message:
          `Il manque :\n${formatShortageList(shortage)}\n\n` +
          'Si vous venez de les produire, confirmez : la quantité sera ajoutée au stock puis décomptée par cette commande.',
        confirmLabel: 'Oui, je les ai produits',
        cancelLabel: 'Non, annuler',
      });
    },
    [confirm]
  );

  return { confirmShortage, shortageDialog: confirmDialog };
}
