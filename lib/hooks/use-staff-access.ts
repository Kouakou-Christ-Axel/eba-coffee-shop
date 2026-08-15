'use client';

// lib/hooks/use-staff-access.ts
//
// « Ce visiteur est-il un membre du staff ? » — pour les DEUX raccourcis
// dashboard du site vitrine (bouton de la navbar + `DashboardFab`).
//
// Ces deux composants appelaient `authClient.useSession()` directement. Sur un
// site dont le trafic est quasi exclusivement anonyme, ça faisait payer à tout
// le monde ce qui ne sert qu'à une poignée de personnes :
//   1. le client Better Auth (+ nanostores) entrait dans le chunk du layout
//      public, donc téléchargé et évalué sur TOUTES les pages du site ;
//   2. un `GET /api/auth/get-session` partait pendant l'hydratation, non
//      cacheable, en concurrence directe avec le rendu du contenu — sur une
//      connexion mobile ivoirienne, le RTT pèse plus lourd que les octets.
//
// Ici on fait les deux choses tardivement : le module Better Auth est chargé
// par `import()` dynamique (il sort donc du chunk initial), et seulement quand
// le navigateur est au repos. Le staff voit son raccourci apparaître une
// fraction de seconde après le reste — un délai sans conséquence pour un
// raccourci de confort, alors que l'anonyme, lui, ne paie plus rien du tout.

import { useEffect, useState } from 'react';
import { DASHBOARD_ROLES } from '@/config/constants';

// Filet de sécurité si `requestIdleCallback` ne se déclenche jamais (onglet
// d'arrière-plan) et repli pour Safari, qui ne l'implémente toujours pas.
const IDLE_TIMEOUT_MS = 3000;

export function useStaffAccess(): boolean {
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const resolve = async () => {
      try {
        const { authClient } = await import('@/lib/auth-client');
        const { data } = await authClient.getSession();
        if (cancelled) return;
        const role = (data?.user as { role?: string } | undefined)?.role;
        setHasAccess(!!role && (DASHBOARD_ROLES as string[]).includes(role));
      } catch {
        // Pas de session, hors ligne, requête annulée : on reste anonyme.
        // C'est un raccourci de confort, jamais un contrôle d'accès — le
        // dashboard est protégé côté serveur.
      }
    };

    if (typeof window.requestIdleCallback === 'function') {
      const handle = window.requestIdleCallback(resolve, {
        timeout: IDLE_TIMEOUT_MS,
      });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(handle);
      };
    }

    const timer = window.setTimeout(resolve, IDLE_TIMEOUT_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  return hasAccess;
}
