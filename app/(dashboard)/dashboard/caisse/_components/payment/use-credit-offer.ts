'use client';

import { useEffect, useState } from 'react';

export type CreditOffer = { balance: number; applicable: number };

/**
 * Avoir proposable sur la commande, lu à l'ouverture de la modale d'encaissement.
 * Toute erreur (réseau, rôle sans accès caisse) revient à « aucune offre » : le
 * paiement normal n'en dépend jamais.
 */
export function useCreditOffer(
  orderId: string | undefined,
  isOpen: boolean
): CreditOffer | null {
  const [offer, setOffer] = useState<CreditOffer | null>(null);

  useEffect(() => {
    if (!orderId || !isOpen) return;
    const controller = new AbortController();
    fetch(`/api/caisse/orders/${orderId}/credit`, {
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: CreditOffer | null) => {
        setOffer(data && data.applicable > 0 ? data : null);
      })
      .catch(() => setOffer(null));
    return () => controller.abort();
  }, [orderId, isOpen]);

  return isOpen ? offer : null;
}
