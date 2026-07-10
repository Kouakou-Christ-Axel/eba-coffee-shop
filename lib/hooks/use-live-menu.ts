'use client';

// lib/hooks/use-live-menu.ts
//
// Menu caisse « live » : part d'un snapshot serveur, puis se rafraîchit
// périodiquement et au retour de l'onglet (`/api/caisse/menu`) pour refléter
// une réappro faite ailleurs (autre appareil, cuisine) sans recharger la page.
// Expose aussi `applyRestock` pour une mise à jour optimiste immédiate après
// une réappro déclenchée localement.

import { useCallback, useEffect, useState } from 'react';
import type { MenuCategory } from '@/config/menu';
import { applyRestockToMenu, type RestockRef } from '@/lib/caisse-restock';

const REFRESH_INTERVAL_MS = 20_000;

export function useLiveMenu(initial: MenuCategory[]) {
  const [menu, setMenu] = useState<MenuCategory[]>(initial);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/caisse/menu', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { menu?: MenuCategory[] };
      if (Array.isArray(data.menu)) setMenu(data.menu);
    } catch {
      // Réseau indisponible : on garde le dernier menu connu.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (!cancelled && document.visibilityState === 'visible') void refresh();
    };
    const interval = setInterval(tick, REFRESH_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  /** Mise à jour optimiste locale après une réappro déclenchée en caisse. */
  const applyRestock = useCallback(
    (ref: RestockRef, stockQuantity: number | null) => {
      setMenu((prev) => applyRestockToMenu(prev, ref, stockQuantity));
    },
    []
  );

  return { menu, setMenu, refresh, applyRestock };
}
