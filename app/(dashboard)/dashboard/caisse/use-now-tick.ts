'use client';

import { useEffect, useState } from 'react';

/**
 * Renvoie un `Date` rafraîchi à intervalle régulier (défaut 30 s).
 *
 * Utilisé pour propager le recalcul des âges/urgences à toutes les cartes
 * sans toucher au state du queue. Mobile-friendly : 30 s est largement assez
 * pour des seuils en minutes et ménage la batterie.
 */
export function useNowTick(intervalMs = 30_000): Date {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
