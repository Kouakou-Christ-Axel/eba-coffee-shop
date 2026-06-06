'use client';

// lib/hooks/use-orders-stream.ts
//
// Hook réutilisable encapsulant la connexion SSE des écrans dashboard
// (caisse, préparation). Gère :
//   - connexion à `endpoint` (event listener `queue` JSON)
//   - normalisation des payloads via la fonction fournie (`normalize`)
//   - détection des nouvelles commandes (par `getId`) → callback `onNewOrders`
//   - reconnexion automatique avec backoff exponentiel borné (max 15 s)
//   - cleanup propre à l'unmount
//
// Note : `EventSource` ne reconnecte pas tout seul après un CLOSED
// (ex. 401 transitoire ou hot-reload du dev server) — on gère donc la
// reconnexion à la main.

import { useCallback, useEffect, useRef, useState } from 'react';

export type ConnState =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected';

export type UseOrdersStreamOptions<T> = {
  /** URL du flux SSE (ex. `/api/caisse/stream`). */
  endpoint: string;
  /** Snapshot initial fourni par le rendu serveur. */
  initialOrders: T[];
  /**
   * Transforme un payload brut SSE (objet JSON) en commande prête à consommer.
   * Typiquement, re-désérialise les `Date` (cf. `normalizeOrderDates`).
   */
  normalize: (raw: unknown) => T;
  /** Identifiant stable d'une commande, utilisé pour détecter les nouvelles. */
  getId: (order: T) => string;
  /**
   * Appelé après chaque snapshot SSE avec les commandes apparues depuis le
   * snapshot précédent. Utile pour déclencher un son ou une notification.
   */
  onNewOrders?: (newOrders: T[]) => void;
  /**
   * URL de l'endpoint REST à interroger en fallback (ex. `/api/caisse/queue`).
   * Nécessaire quand le SSE est bloqué par un proxy (Cloudflare, Nginx…).
   * Si absent, aucun polling n'est effectué.
   */
  pollEndpoint?: string;
  /**
   * Intervalle de polling en ms (défaut : 10 000).
   * Le polling ne démarre que si `pollEndpoint` est fourni et si aucun
   * événement SSE n'a été reçu depuis `pollInterval * 3` ms.
   */
  pollInterval?: number;
};

export type UseOrdersStreamResult<T> = {
  orders: T[];
  connState: ConnState;
  lastSync: Date | null;
};

const POLL_INTERVAL_DEFAULT_MS = 10_000;
const POLL_STALE_MULTIPLIER = 3;

export function useOrdersStream<T>(
  options: UseOrdersStreamOptions<T>
): UseOrdersStreamResult<T> {
  const {
    endpoint,
    initialOrders,
    normalize,
    getId,
    onNewOrders,
    pollEndpoint,
    pollInterval,
  } = options;

  const [orders, setOrders] = useState<T[]>(initialOrders);
  const [connState, setConnState] = useState<ConnState>('connecting');
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const knownIdsRef = useRef<Set<string>>(
    new Set(initialOrders.map((o) => getId(o)))
  );
  const lastSyncTimeRef = useRef<number>(0);

  // Refs pour stabiliser les callbacks dans l'effet "monter une fois".
  const normalizeRef = useRef(normalize);
  const getIdRef = useRef(getId);
  const onNewOrdersRef = useRef(onNewOrders);

  useEffect(() => {
    normalizeRef.current = normalize;
    getIdRef.current = getId;
    onNewOrdersRef.current = onNewOrders;
  }, [normalize, getId, onNewOrders]);

  // Polling fallback : déclenché quand SSE est bloqué par un proxy (Cloudflare…).
  // Ne fait rien si `pollEndpoint` est absent.
  // Ne déclenche un fetch que si le dernier sync SSE date de plus de
  // `pollInterval * POLL_STALE_MULTIPLIER` ms, pour éviter le polling inutile
  // quand le SSE fonctionne normalement.
  useEffect(() => {
    if (!pollEndpoint) return;
    const interval = pollInterval ?? POLL_INTERVAL_DEFAULT_MS;
    const staleThreshold = interval * POLL_STALE_MULTIPLIER;

    const doPoll = async () => {
      if (Date.now() - lastSyncTimeRef.current < staleThreshold) return;
      try {
        const res = await fetch(pollEndpoint, { credentials: 'same-origin' });
        if (!res.ok) return;
        const data: unknown = await res.json();
        if (!Array.isArray(data)) return;
        const fresh = (data as unknown[]).map((r) => normalizeRef.current(r));
        const known = knownIdsRef.current;
        const newOrders = fresh.filter((o) => !known.has(getIdRef.current(o)));
        knownIdsRef.current = new Set(fresh.map((o) => getIdRef.current(o)));
        lastSyncTimeRef.current = Date.now();
        setOrders(fresh);
        setLastSync(new Date());
        if (newOrders.length > 0) onNewOrdersRef.current?.(newOrders);
      } catch {
        // silencieux — le SSE reste la source primaire
      }
    };

    const timer = setInterval(doPoll, interval);
    return () => clearInterval(timer);
  }, [pollEndpoint, pollInterval]);

  useEffect(() => {
    let currentEs: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let retryAttempt = 0;
    let cancelled = false;

    const handleQueue = (e: MessageEvent) => {
      let raw: unknown[];
      try {
        const parsed = JSON.parse(e.data);
        if (!Array.isArray(parsed)) return;
        raw = parsed;
      } catch {
        return;
      }
      const fresh = raw.map((r) => normalizeRef.current(r));

      const known = knownIdsRef.current;
      const newOrders = fresh.filter((o) => !known.has(getIdRef.current(o)));
      knownIdsRef.current = new Set(fresh.map((o) => getIdRef.current(o)));

      lastSyncTimeRef.current = Date.now();
      setOrders(fresh);
      setLastSync(new Date());

      if (newOrders.length > 0) {
        onNewOrdersRef.current?.(newOrders);
      }
    };

    const connect = () => {
      if (cancelled) return;
      const es = new EventSource(endpoint);
      currentEs = es;

      es.addEventListener('open', () => {
        if (cancelled) return;
        retryAttempt = 0;
        setConnState('connected');
      });

      es.addEventListener('queue', handleQueue);

      es.addEventListener('error', () => {
        if (cancelled) return;
        if (es.readyState === EventSource.CLOSED) {
          setConnState('disconnected');
          es.close();
          // Backoff exponentiel borné : 1s, 2s, 4s, 8s, 15s max
          const delay = Math.min(1000 * Math.pow(2, retryAttempt), 15_000);
          retryAttempt += 1;
          retryTimer = setTimeout(() => {
            setConnState('reconnecting');
            connect();
          }, delay);
        } else {
          setConnState('reconnecting');
        }
      });
    };

    connect();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      currentEs?.close();
    };
  }, [endpoint]);

  return { orders, connState, lastSync };
}

/**
 * Joue un carillon (deux notes alternées) signalant une nouvelle commande.
 * No-op côté serveur ou sans AudioContext disponible.
 */
export function playNewOrderChime() {
  if (typeof window === 'undefined') return;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return;
  const ctx = new AudioCtx();
  const notes: Array<{ freq: number; start: number; duration: number }> = [
    { freq: 880, start: 0, duration: 0.18 },
    { freq: 1318.51, start: 0.2, duration: 0.18 },
    { freq: 880, start: 0.55, duration: 0.18 },
    { freq: 1318.51, start: 0.75, duration: 0.3 },
  ];
  const now = ctx.currentTime;
  for (const note of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = note.freq;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const startAt = now + note.start;
    const endAt = startAt + note.duration;
    gain.gain.setValueAtTime(0, startAt);
    gain.gain.linearRampToValueAtTime(0.25, startAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, endAt);
    osc.start(startAt);
    osc.stop(endAt + 0.05);
  }
  setTimeout(() => ctx.close(), 1500);
}

/**
 * Hook utilitaire qui mémorise la préférence "son activé" dans localStorage
 * et expose une ref synchronisée pour les callbacks SSE.
 */
export function useSoundPreference(storageKey: string): {
  soundEnabled: boolean;
  soundEnabledRef: React.MutableRefObject<boolean>;
  toggleSound: () => void;
} {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const soundEnabledRef = useRef(true);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved === 'false') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration depuis localStorage
      setSoundEnabled(false);
      soundEnabledRef.current = false;
    }
  }, [storageKey]);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      soundEnabledRef.current = next;
      try {
        localStorage.setItem(storageKey, String(next));
      } catch {
        // Quota / mode privé : on ignore.
      }
      if (next) playNewOrderChime();
      return next;
    });
  }, [storageKey]);

  return { soundEnabled, soundEnabledRef, toggleSound };
}
