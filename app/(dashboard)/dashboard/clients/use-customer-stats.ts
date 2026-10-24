'use client';

// Stats des clients de la page affichée, chargées à part de la liste
// (`GET /api/customers/stats`) en rejouant les filtres de l'URL (recherche,
// page, tri). La liste s'affiche sans elles ; les cellules concernées montrent
// un squelette jusqu'à l'arrivée de la réponse. Les stats sont indexées par id :
// une réponse légèrement en retard ne peut pas s'afficher sur le mauvais client.

import { useEffect, useState } from 'react';
import type { CustomerStats } from '@/lib/customers';
import { useClientsNav } from './use-clients-nav';

type Loaded = { key: string; stats: Record<string, CustomerStats> };

export function useCustomerStats(enabled: boolean) {
  const { filters } = useClientsNav();
  const { search, page, sort, dir } = filters;
  const key = enabled
    ? new URLSearchParams({
        ...(search ? { search } : {}),
        page: String(page),
        ...(sort ? { sort } : {}),
        dir,
      }).toString()
    : '';
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (!key) return;
    const ctrl = new AbortController();
    fetch(`/api/customers/stats?${key}`, {
      signal: ctrl.signal,
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then(
        (data: {
          stats: Record<
            string,
            | (Omit<CustomerStats, 'lastOrderAt'> & {
                lastOrderAt: string | null;
              })
            | null
          >;
        }) => {
          const stats = Object.fromEntries(
            Object.entries(data.stats).flatMap(([id, s]) =>
              s
                ? [
                    [
                      id,
                      {
                        ...s,
                        lastOrderAt: s.lastOrderAt
                          ? new Date(s.lastOrderAt)
                          : null,
                      },
                    ],
                  ]
                : []
            )
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

  // Une réponse d'une autre requête n'est jamais affichée.
  return loaded?.key === key ? loaded.stats : null;
}
