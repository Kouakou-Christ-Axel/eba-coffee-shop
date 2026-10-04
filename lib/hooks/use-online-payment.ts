'use client';

// lib/hooks/use-online-payment.ts
//
// Lit `GET /api/paiement/config` : le paiement en ligne est-il actif, à quel taux
// de frais, avec quels moyens ? Lu côté CLIENT car la page de checkout est
// prérendue : un drapeau lu côté serveur serait figé au build.

import { useEffect, useState } from 'react';
import {
  parseOnlinePaymentConfig,
  type OnlinePaymentConfig,
} from '@/lib/online-payment-config';

export type OnlinePaymentState =
  | { status: 'loading' }
  | { status: 'error' }
  | ({ status: 'ready' } & OnlinePaymentConfig);

export function useOnlinePayment(): OnlinePaymentState {
  const [state, setState] = useState<OnlinePaymentState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/paiement/config', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        const config = parseOnlinePaymentConfig(data);
        setState(config ? { status: 'ready', ...config } : { status: 'error' });
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
