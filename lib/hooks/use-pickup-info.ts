'use client';

// lib/hooks/use-pickup-info.ts
//
// Charge en un seul appel tout ce dont l'étape « retrait » du modal de
// commande a besoin : créneaux disponibles, lead time, plages d'ouverture par
// jour et lieu de retrait (réponse enrichie de GET /api/pickup-slots).
// Partagé entre le choix de mode (adresse pour le livreur) et le sélecteur
// de créneau — un seul fetch pour le modal.

import { useEffect, useState } from 'react';
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
  | { status: 'error' }
  | ({ status: 'ready' } & PickupInfo);

export function usePickupInfo(): PickupInfoState {
  const [state, setState] = useState<PickupInfoState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/pickup-slots')
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
        if (!cancelled) setState({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
