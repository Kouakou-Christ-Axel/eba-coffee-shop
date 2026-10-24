'use client';

// Stats des clients de la page, reçues en streaming : le composant serveur lance
// la requête de stats en même temps que celle de la liste (`getPageStats`) et
// passe la PROMESSE au tableau, qui s'affiche sans l'attendre.
//
// Trois états explicites — un échec ne doit pas ressembler à « aucune commande » :
// `loading` (squelette), `error` (message + « — »), `ready`.

import { useEffect, useState } from 'react';
import type { CustomerStats } from '@/lib/customers';

export type StatsById = Record<string, CustomerStats>;

export type StreamedStats =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; byId: StatsById };

type Settled = { promise: Promise<StatsById>; result: StreamedStats };

export function useStreamedStats(promise: Promise<StatsById>): StreamedStats {
  const [settled, setSettled] = useState<Settled | null>(null);

  useEffect(() => {
    let cancelled = false;
    promise.then(
      (byId) => {
        if (!cancelled)
          setSettled({ promise, result: { status: 'ready', byId } });
      },
      () => {
        if (!cancelled) setSettled({ promise, result: { status: 'error' } });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [promise]);

  // Une réponse d'une autre page (autre promesse) n'est jamais affichée.
  return settled?.promise === promise ? settled.result : { status: 'loading' };
}
