'use client';

import { useEffect, useState } from 'react';
import type { MenuCategory } from '@/config/menu';

/** Menu frais (stock compris) : celui de l'appelant s'il l'a déjà chargé,
 * sinon chargé à l'ouverture du panneau. `null` = en cours, `[]` = échec. */
export function useMenuWhenOpen(
  isOpen: boolean,
  preloaded: MenuCategory[] | null | undefined
): MenuCategory[] | null {
  const [menu, setMenu] = useState<MenuCategory[] | null>(null);
  useEffect(() => {
    if (!isOpen || menu || preloaded) return;
    let cancelled = false;
    fetch('/api/menu')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: MenuCategory[] | null) => {
        if (!cancelled) setMenu(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setMenu([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, menu, preloaded]);
  return preloaded ?? menu;
}
