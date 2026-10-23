'use client';

// lib/hooks/use-credit-offer.ts
//
// Avoir du client pour le téléphone et le total net saisis au checkout
// (GET /api/credit-info?phone=…&total=…, débouncé). Comme la récompense
// fidélité, c'est un bonus et jamais un blocage : toute erreur retombe sur
// « aucun avoir ». La règle d'usage est ré-appliquée par le serveur à la création.

import { useEffect, useState } from 'react';
import { ORDER_CUSTOMER_PHONE_MAX } from '@/config/constants';

const DEBOUNCE_MS = 500;

export type CreditOfferState =
  | { status: 'none' }
  | { status: 'ready'; balance: number; applicable: number };

const NONE: CreditOfferState = { status: 'none' };

export function useCreditOffer(
  phone: string,
  netTotal: number,
  enabled: boolean
): CreditOfferState {
  const [state, setState] = useState<CreditOfferState>(NONE);

  useEffect(() => {
    const trimmed = phone.trim();
    const valid =
      enabled &&
      netTotal > 0 &&
      trimmed.length >= 8 &&
      trimmed.length <= ORDER_CUSTOMER_PHONE_MAX;
    let cancelled = false;

    const timer = setTimeout(
      () => {
        if (cancelled) return;
        if (!valid) {
          setState(NONE);
          return;
        }
        const params = new URLSearchParams({
          phone: trimmed,
          total: String(Math.trunc(netTotal)),
        });
        fetch(`/api/credit-info?${params.toString()}`)
          .then((r) => (r.ok ? r.json() : Promise.reject()))
          .then((data: { balance?: number; applicable?: number }) => {
            if (cancelled) return;
            setState(
              data.applicable && data.applicable > 0
                ? {
                    status: 'ready',
                    balance: data.balance ?? data.applicable,
                    applicable: data.applicable,
                  }
                : NONE
            );
          })
          .catch(() => {
            if (!cancelled) setState(NONE);
          });
      },
      valid ? DEBOUNCE_MS : 0
    );

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [phone, netTotal, enabled]);

  return state;
}
