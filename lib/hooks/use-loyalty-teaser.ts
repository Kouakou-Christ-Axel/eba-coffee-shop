'use client';

// lib/hooks/use-loyalty-teaser.ts
//
// Message fidélité incitatif du récapitulatif de commande (avant paiement),
// pour le téléphone ET le total net saisis au checkout
// (GET /api/loyalty-info?phone=…&cartTotal=…, débouncé). Calculé côté
// serveur : le compteur de tampons n'est jamais exposé au client (cf.
// app/api/loyalty-info/route.ts). `null` = rien à afficher (programme
// désactivé, téléphone pas encore identifiable, ou erreur réseau).

import { useEffect, useState } from 'react';
import { ORDER_CUSTOMER_PHONE_MAX } from '@/config/constants';

const DEBOUNCE_MS = 500;

export function useLoyaltyTeaser(
  phone: string,
  cartTotal: number
): string | null {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = phone.trim();
    const valid =
      trimmed.length >= 8 && trimmed.length <= ORDER_CUSTOMER_PHONE_MAX;
    let cancelled = false;

    const timer = setTimeout(
      () => {
        if (cancelled) return;
        if (!valid) {
          setMessage(null);
          return;
        }
        const params = new URLSearchParams({
          phone: trimmed,
          cartTotal: String(Math.max(0, Math.trunc(cartTotal))),
        });
        fetch(`/api/loyalty-info?${params.toString()}`)
          .then((r) => (r.ok ? r.json() : Promise.reject()))
          .then((data: { message?: string | null }) => {
            if (!cancelled) setMessage(data.message ?? null);
          })
          .catch(() => {
            if (!cancelled) setMessage(null);
          });
      },
      // Reset immédiat quand le numéro redevient invalide (champ vidé).
      valid ? DEBOUNCE_MS : 0
    );

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [phone, cartTotal]);

  return message;
}
