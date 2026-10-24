'use client';

// Stats des clients de la page affichée, chargées à part de la liste
// (`GET /api/customers/stats`). La liste s'affiche sans elles ; les cellules
// concernées montrent un squelette jusqu'à l'arrivée de la réponse.

import { useEffect, useState } from 'react';
import type { CustomerStats } from '@/lib/customers';

type Loaded = { key: string; stats: Record<string, CustomerStats> };

export function useCustomerStats(ids: string[]) {
  const key = ids.join(',');
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (!key) return;
    const ctrl = new AbortController();
    fetch(`/api/customers/stats?ids=${encodeURIComponent(key)}`, {
      signal: ctrl.signal,
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then(
        (data: {
          stats: Record<
            string,
            Omit<CustomerStats, 'lastOrderAt'> & { lastOrderAt: string | null }
          >;
        }) => {
          const stats = Object.fromEntries(
            Object.entries(data.stats).map(([id, s]) => [
              id,
              {
                ...s,
                lastOrderAt: s.lastOrderAt ? new Date(s.lastOrderAt) : null,
              },
            ])
          );
          setLoaded({ key, stats });
        }
      )
      .catch(() => {
        // Annulation (changement de page) ou erreur réseau : les cellules
        // restent en squelette, la liste elle-même n'est pas affectée.
      });
    return () => ctrl.abort();
  }, [key]);

  // Une réponse d'une autre page n'est jamais affichée.
  return loaded?.key === key ? loaded.stats : null;
}
