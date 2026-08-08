'use client';

// lib/hooks/use-order-history.ts
//
// Lecture réactive de l'historique local des commandes (lib/order-history.ts,
// localStorage — sans compte). Le snapshot serveur vaut `false` : les entrées
// conditionnelles (pill de /carte, icône navbar) rendent `null` au SSR et au
// premier rendu client, donc aucun mismatch d'hydratation.

import { useSyncExternalStore } from 'react';
import { readOrderHistory, subscribeOrderHistory } from '@/lib/order-history';

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
