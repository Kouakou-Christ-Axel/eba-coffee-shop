'use client';

// lib/hooks/use-pickup-info.ts
//
// Charge en un seul appel tout ce dont l'étape « retrait » du modal de
// commande a besoin : créneaux disponibles, lead time, plages d'ouverture par
// jour et lieu de retrait (réponse enrichie de GET /api/pickup-slots).
// Partagé entre le choix de mode (adresse pour le livreur) et le sélecteur
// de créneau — un seul fetch pour le modal.

import { useCallback, useEffect, useState } from 'react';
import type { TimeRange } from '@/lib/pickup-settings';

export type PickupDay = {
  /** Jour civil Abidjan, YYYY-MM-DD. */
  date: string;
  /** Plages d'ouverture ; vide = fermé ce jour. */
  ranges: TimeRange[];
};

export type PickupInfo = {
  /** Créneaux réservables (lead time + capacité déjà appliqués). */
  slots: Date[];
  leadTimeMin: number;
  days: PickupDay[];
  pickupAddress: string | null;
  pickupMapsUrl: string | null;
};

export type PickupInfoState =
  | { status: 'loading' }
  | { status: 'error'; retry: () => void }
  | ({ status: 'ready' } & PickupInfo);

/**
 * `minDays` : délai minimum (jours) requis par le panier courant (voir
 * `Product.advanceOrderDays`, lib/menu.ts) — étend l'horizon de créneaux
 * au-delà du réglage global si besoin (voir `/api/pickup-slots?minDays=`).
 * 0/absent = pas de contrainte, comportement inchangé.
 *
 * `enabled` : à `false`, aucun appel réseau n'est déclenché et l'état reste
 * `loading`. Indispensable dans le dashboard, où `EditFulfillmentModal` est
 * monté pour CHAQUE carte de la file caisse (`isOpen` en prop) : sans ce
 * garde-fou, afficher vingt commandes déclencherait vingt requêtes. Les
 * appelants passent `enabled={isOpen}` — un seul appel, à l'ouverture.
 */
export function usePickupInfo(minDays = 0, enabled = true): PickupInfoState {
  const [state, setState] = useState<PickupInfoState>({ status: 'loading' });
  // Compteur de tentatives : `retry()` relance le fetch sans recharger la
  // page (un reload viderait le contexte du checkout en cours).
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((a) => a + 1);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const url =
      minDays > 0
        ? `/api/pickup-slots?minDays=${minDays}`
        : '/api/pickup-slots';
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(
        (data: {
          slots: string[];
          leadTimeMin: number;
          days: PickupDay[];
          pickupAddress: string | null;
          pickupMapsUrl: string | null;
        }) => {
          if (cancelled) return;
          setState({
            status: 'ready',
            slots: data.slots.map((s) => new Date(s)),
            leadTimeMin: data.leadTimeMin,
            days: data.days,
            pickupAddress: data.pickupAddress,
            pickupMapsUrl: data.pickupMapsUrl,
          });
        }
      )
      .catch(() => {
        if (!cancelled) setState({ status: 'error', retry });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt, retry, minDays, enabled]);

  return state;
}
