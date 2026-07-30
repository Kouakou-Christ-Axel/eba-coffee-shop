// lib/order-history.ts
//
// Historique local « mes commandes » — SANS compte utilisateur.
//
// L'URL de suivi (/commande/:id) n'est montrée qu'une fois après la
// soumission : on la conserve ici, côté appareil (localStorage), pour que le
// client retrouve ses commandes (page /mes-commandes) et que le checkout
// pré-remplisse ses coordonnées à la commande suivante. Écrit UNIQUEMENT au
// moment de la soumission (use-checkout-form.ts) — jamais à la simple visite
// d'une page de suivi, pour ne pas polluer l'appareil d'un livreur qui ouvre
// un lien partagé.
//
// Helpers purs client : tout accès localStorage est enveloppé de try/catch
// (Safari privé, quota, JSON corrompu → no-op / valeur vide).

import { ORDER_HISTORY_MAX } from '@/config/constants';

// Clés localStorage — même convention que 'eba-push-order'
// (order-notifications.tsx) et 'eba-cart' (lib/cart-store.ts).
const ORDERS_KEY = 'eba-orders';
const LAST_CONTACT_KEY = 'eba-last-contact';

export type StoredOrder = {
  /** Id cuid de la commande — sert à reconstruire l'URL /commande/:id. */
  id: string;
  /** Référence complète (EBA-YYYYMMDD-XXXX). */
  reference: string;
  /** Total payé/à payer en FCFA (net, tel que soumis). */
  total: number;
  /** Date de soumission, ISO 8601. */
  createdAt: string;
};

export type StoredContact = {
  name: string;
  phone: string;
};

function isStoredOrder(value: unknown): value is StoredOrder {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.reference === 'string' &&
    typeof v.total === 'number' &&
    typeof v.createdAt === 'string'
  );
}

// ─── Store externe (useSyncExternalStore) ────────────────────────────────────
//
// Les composants lisent l'historique via `useSyncExternalStore(
// subscribeOrderHistory, readOrderHistory, getOrderHistoryServerSnapshot)` :
// pas de setState-dans-effet, pas de mismatch d'hydratation (le snapshot
// serveur est un sentinel distinct, voir `ORDER_HISTORY_HYDRATING`).
//
// `readOrderHistory` met en cache le résultat parsé tant que la chaîne brute
// n'a pas changé — identité stable exigée par useSyncExternalStore.

type Listener = () => void;
const listeners = new Set<Listener>();

function emitOrderHistoryChange(): void {
  listeners.forEach((l) => l());
}

/** Abonnement aux changements (écritures locales + autres onglets). */
export function subscribeOrderHistory(listener: Listener): () => void {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

/**
 * Snapshot serveur / hydratation : sentinel distinct de tout snapshot client,
 * pour qu'un composant puisse rendre `null` pendant l'hydratation au lieu de
 * flasher l'état « aucune commande ».
 */
export const ORDER_HISTORY_HYDRATING: StoredOrder[] = [];

export function getOrderHistoryServerSnapshot(): StoredOrder[] {
  return ORDER_HISTORY_HYDRATING;
}

const EMPTY_HISTORY: StoredOrder[] = [];
let historyCacheRaw: string | null | undefined;
let historyCache: StoredOrder[] = EMPTY_HISTORY;

/** Commandes passées depuis cet appareil, la plus récente d'abord. */
export function readOrderHistory(): StoredOrder[] {
  if (typeof window === 'undefined') return EMPTY_HISTORY;
  try {
    const raw = window.localStorage.getItem(ORDERS_KEY);
    if (raw !== historyCacheRaw) {
      historyCacheRaw = raw;
      // En cas de JSON corrompu (throw ci-dessous), le cache doit refléter
      // « vide » pour cette valeur brute — jamais un ancien contenu.
      historyCache = EMPTY_HISTORY;
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          historyCache = parsed.filter(isStoredOrder);
        }
      }
    }
    return historyCache;
  } catch {
    return EMPTY_HISTORY;
  }
}

/** Ajoute une commande en tête (dédup par id, plafond ORDER_HISTORY_MAX). */
export function addOrderToHistory(entry: StoredOrder): void {
  if (typeof window === 'undefined') return;
  try {
    const next = [
      entry,
      ...readOrderHistory().filter((o) => o.id !== entry.id),
    ].slice(0, ORDER_HISTORY_MAX);
    window.localStorage.setItem(ORDERS_KEY, JSON.stringify(next));
    emitOrderHistoryChange();
  } catch {
    // localStorage indisponible : l'historique est un bonus, jamais bloquant.
  }
}

export function clearOrderHistory(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(ORDERS_KEY);
    emitOrderHistoryChange();
  } catch {
    // no-op
  }
}

/** Coordonnées de la dernière commande (pré-remplissage du checkout). */
export function readLastContact(): StoredContact | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LAST_CONTACT_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const v = parsed as Record<string, unknown>;
    if (typeof v.name !== 'string' || typeof v.phone !== 'string') return null;
    return { name: v.name, phone: v.phone };
  } catch {
    return null;
  }
}

export function saveLastContact(contact: StoredContact): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LAST_CONTACT_KEY, JSON.stringify(contact));
  } catch {
    // no-op
  }
}
