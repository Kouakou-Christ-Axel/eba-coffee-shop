'use client';

// lib/hooks/use-order-history.ts
//
// Lecture réactive de l'historique local des commandes (lib/order-history.ts,
// localStorage — sans compte). Le snapshot serveur vaut `false` : les entrées
// conditionnelles (pill de /carte, icône navbar) rendent `null` au SSR et au
// premier rendu client, donc aucun mismatch d'hydratation.

import { useSyncExternalStore } from 'react';
import {
  readOrderHistory,
  subscribeOrderHistory,
  type StoredOrder,
} from '@/lib/order-history';

function hasOrdersSnapshot(): boolean {
  return readOrderHistory().length > 0;
}

function serverSnapshot(): boolean {
  return false;
}

/** Vrai si cet appareil a déjà passé au moins une commande. */
export function useHasOrderHistory(): boolean {
  return useSyncExternalStore(
    subscribeOrderHistory,
    hasOrdersSnapshot,
    serverSnapshot
  );
}

// `readOrderHistory` met en cache le tableau parsé tant que la chaîne brute
// n'a pas changé : l'identité de `[0]` est donc stable d'un snapshot à
// l'autre, comme `useSyncExternalStore` l'exige.
function lastOrderSnapshot(): StoredOrder | null {
  return readOrderHistory()[0] ?? null;
}

function lastOrderServerSnapshot(): StoredOrder | null {
  return null;
}

/** Commande la plus récente passée depuis cet appareil, `null` au SSR. */
export function useLastOrder(): StoredOrder | null {
  return useSyncExternalStore(
    subscribeOrderHistory,
    lastOrderSnapshot,
    lastOrderServerSnapshot
  );
}
