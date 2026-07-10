'use client';

// lib/hooks/use-now-tick.ts
//
// Horloge « maintenant » qui se rafraîchit à intervalle régulier, pour animer
// les minuteurs (chronos) sans dépendre d'un événement serveur. Partagée par
// les écrans staff (cuisine, caisse-view ré-exporte sa propre copie historique).

import { useEffect, useState } from 'react';

export function useNowTick(intervalMs = 15_000): Date {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
