'use client';

// lib/hooks/use-public-menu.ts
//
// Menu de la carte publique « live » : part du rendu ISR (props), puis relit
// `/api/menu` toutes les 30 s (onglet visible seulement), au retour sur
// l'onglet et au retour du réseau. Un produit qui s'épuise passe en « épuisé »
// sans que le client ait à recharger la page.
//
// Deux choses ne viennent PAS de `/api/menu` et sont reportées depuis le rendu
// serveur : le rang de popularité (agrégat lourd, voir lib/menu-popularity.ts)
// et l'ordre d'affichage (dépend de l'heure, voir lib/menu-display.ts).

import { useEffect, useRef, useState } from 'react';
import type { MenuCategory } from '@/config/menu';
import { sortProductsForDisplay } from '@/lib/menu-display';

export const PUBLIC_MENU_REFRESH_MS = 30_000;

/** Reporte `popularRank` du menu servi par l'ISR sur le menu frais. */
export function carryPopularity(
  fresh: MenuCategory[],
  initial: MenuCategory[]
): MenuCategory[] {
  const ranks = new Map<string, number>();
  for (const category of initial) {
    for (const p of category.products) {
      if (p.popularRank != null) ranks.set(p.id, p.popularRank);
    }
  }
  if (ranks.size === 0) return fresh;
  return fresh.map((category) => ({
    ...category,
    products: category.products.map((p) =>
      ranks.has(p.id) ? { ...p, popularRank: ranks.get(p.id) } : p
    ),
  }));
}

export function usePublicMenu(initial: MenuCategory[]): MenuCategory[] {
  const [menu, setMenu] = useState<MenuCategory[]>(initial);
  // Dernière version vue, sérialisée : si rien n'a changé on garde la
  // référence du tableau, ce qui préserve les `useMemo` en aval.
  const lastRaw = useRef<string | null>(null);
  const inflight = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      if (inflight.current || document.visibilityState !== 'visible') return;
      inflight.current = true;
      try {
        const res = await fetch('/api/menu', { cache: 'no-store' });
        if (!res.ok || cancelled) return;
        const raw = await res.text();
        if (cancelled || raw === lastRaw.current) return;
        const data = JSON.parse(raw) as MenuCategory[];
        if (!Array.isArray(data)) return;
        lastRaw.current = raw;
        setMenu(sortProductsForDisplay(carryPopularity(data, initial)));
      } catch {
        // Réseau indisponible ou JSON invalide : on garde le dernier menu.
      } finally {
        inflight.current = false;
      }
    };

    const interval = setInterval(() => void refresh(), PUBLIC_MENU_REFRESH_MS);
    const onVisible = () => void refresh();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onVisible);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onVisible);
    };
    // `initial` ne change que si le serveur re-rend la page : on ne relance pas
    // les écouteurs pour autant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return menu;
}
