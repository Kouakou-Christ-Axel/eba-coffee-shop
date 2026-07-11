'use client';

// lib/hooks/use-loyalty-info.ts
//
// Charge le seuil fidélité public (GET /api/loyalty-info) pour afficher un
// message "plus que X FCFA pour gagner ton point de fidélité" pendant la
// saisie de commande (/carte/commande).

import { useEffect, useState } from 'react';

export type LoyaltyInfo = {
  enabled: boolean;
  minOrderAmount: number;
};

export type LoyaltyInfoState =
  | { status: 'loading' }
  | { status: 'error' }
  | ({ status: 'ready' } & LoyaltyInfo);

export function useLoyaltyInfo(): LoyaltyInfoState {
  const [state, setState] = useState<LoyaltyInfoState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/loyalty-info')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: LoyaltyInfo) => {
        if (cancelled) return;
        setState({
          status: 'ready',
          enabled: data.enabled,
          minOrderAmount: data.minOrderAmount,
        });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
