'use client';

// lib/hooks/use-loyalty-reward.ts
//
// Récompense fidélité utilisable pour le téléphone saisi au checkout
// (GET /api/loyalty-info?phone=…, débouncé). La récompense est un bonus,
// jamais un blocage : toute erreur retombe silencieusement sur `none`.
// La validation finale (appartenance, statut) reste côté serveur dans la
// transaction de commande.
//
// Pour le message incitatif fidélité du récapitulatif (dépend du total NET,
// donc de cette récompense elle-même), voir `use-loyalty-teaser.ts` — un hook
// séparé, pour éviter une dépendance circulaire reward → discount → total.

import { useEffect, useState } from 'react';
import { ORDER_CUSTOMER_PHONE_MAX } from '@/config/constants';

// Attente après la dernière frappe avant d'interroger l'API (le client tape
// son numéro chiffre par chiffre — inutile de requêter à chaque touche).
const PHONE_DEBOUNCE_MS = 500;

export type LoyaltyRewardState =
  | { status: 'idle' } // téléphone trop court / invalide
  | { status: 'loading' }
  | { status: 'none' }
  | { status: 'ready'; id: string; capAmount: number };

export function useLoyaltyReward(phone: string): LoyaltyRewardState {
  const [state, setState] = useState<LoyaltyRewardState>({ status: 'idle' });

  useEffect(() => {
    const trimmed = phone.trim();
    const valid =
      trimmed.length >= 8 && trimmed.length <= ORDER_CUSTOMER_PHONE_MAX;
    let cancelled = false;

    const timer = setTimeout(
      () => {
        if (cancelled) return;
        if (!valid) {
          setState({ status: 'idle' });
          return;
        }
        setState({ status: 'loading' });
        fetch(`/api/loyalty-info?phone=${encodeURIComponent(trimmed)}`)
          .then((r) => (r.ok ? r.json() : Promise.reject()))
          .then(
            (data: { reward?: { id: string; capAmount: number } | null }) => {
              if (cancelled) return;
              setState(
                data.reward
                  ? {
                      status: 'ready',
                      id: data.reward.id,
                      capAmount: data.reward.capAmount,
                    }
                  : { status: 'none' }
              );
            }
          )
          .catch(() => {
            if (!cancelled) setState({ status: 'none' });
          });
      },
      // Reset immédiat quand le numéro redevient invalide (champ vidé).
      valid ? PHONE_DEBOUNCE_MS : 0
    );

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [phone]);

  return state;
}
