'use client';

import { useEffect, useRef, useState } from 'react';
import { startSseLeader, type OpenSseConnection } from '../sse-leader';

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
  /** Transforme un payload brut SSE (objet JSON) en commande prête à consommer. */
  normalize: (raw: unknown) => T;
  /** Identifiant stable d'une commande, utilisé pour détecter les nouvelles. */
  getId: (order: T) => string;
  /** Appelé après chaque snapshot SSE avec les commandes apparues depuis le snapshot précédent. */
  onNewOrders?: (newOrders: T[]) => void;
  /** Durée sans connexion active à partir de laquelle `isStale` passe à `true` (voir `computeIsStale`). */
  staleAfterMs?: number;
};

export type UseOrdersStreamResult<T> = {
  orders: T[];
  connState: ConnState;
  lastSync: Date | null;
  isStale: boolean;
};

export const DEFAULT_STALE_AFTER_MS = 30_000;

export function computeIsStale(
  disconnectedSinceMs: number | null,
  nowMs: number,
  staleAfterMs: number = DEFAULT_STALE_AFTER_MS
): boolean {
  return (
    disconnectedSinceMs !== null && nowMs - disconnectedSinceMs >= staleAfterMs
  );
}

/** Flux SSE des écrans dashboard : reconnexion manuelle avec backoff (EventSource ne reconnecte pas après CLOSED) ; un seul onglet « leader » porte la connexion (`sse-leader.ts`). */
export function useOrdersStream<T>(
  options: UseOrdersStreamOptions<T>
): UseOrdersStreamResult<T> {
  const {
    endpoint,
    initialOrders,
    normalize,
    getId,
    onNewOrders,
    staleAfterMs = DEFAULT_STALE_AFTER_MS,
  } = options;

  const [orders, setOrders] = useState<T[]>(initialOrders);
  const [connState, setConnState] = useState<ConnState>('connecting');
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [isStale, setIsStale] = useState(false);

  const knownIdsRef = useRef<Set<string>>(
    new Set(initialOrders.map((o) => getId(o)))
  );
  // Instant (epoch ms) depuis lequel la connexion est coupée sans interruption ;
  // `null` = connecté (ou pas encore déconnecté depuis le montage).
  const disconnectedSinceRef = useRef<number | null>(null);

  // Refs pour stabiliser les callbacks dans l'effet "monter une fois".
  const normalizeRef = useRef(normalize);
  const getIdRef = useRef(getId);
  const onNewOrdersRef = useRef(onNewOrders);

  useEffect(() => {
    normalizeRef.current = normalize;
    getIdRef.current = getId;
    onNewOrdersRef.current = onNewOrders;
  }, [normalize, getId, onNewOrders]);

  useEffect(() => {
    const handleSnapshot = (raw: unknown[]) => {
      const fresh = raw.map((r) => normalizeRef.current(r));

      const known = knownIdsRef.current;
      const newOrders = fresh.filter((o) => !known.has(getIdRef.current(o)));
      knownIdsRef.current = new Set(fresh.map((o) => getIdRef.current(o)));

      setOrders(fresh);
      setLastSync(new Date());

      if (newOrders.length > 0) {
        onNewOrdersRef.current?.(newOrders);
      }
    };

    const handleConnState = (state: ConnState) => {
      setConnState(state);
      if (state === 'connected') {
        disconnectedSinceRef.current = null;
        setIsStale(false);
      } else if (
        state === 'disconnected' &&
        disconnectedSinceRef.current === null
      ) {
        disconnectedSinceRef.current = Date.now();
      }
    };

    const openConnection: OpenSseConnection = (onSnapshot, onConnState) => {
      let currentEs: EventSource | null = null;
      let retryTimer: ReturnType<typeof setTimeout> | undefined;
      let retryAttempt = 0;
      let cancelled = false;

      const connect = () => {
        if (cancelled) return;
        const es = new EventSource(endpoint);
        currentEs = es;

        es.addEventListener('open', () => {
          if (cancelled) return;
          retryAttempt = 0;
          onConnState('connected');
        });

        es.addEventListener('queue', (e: MessageEvent) => {
          let parsed: unknown;
          try {
            parsed = JSON.parse(e.data);
          } catch {
            return;
          }
          if (!Array.isArray(parsed)) return;
          onSnapshot(parsed);
        });

        es.addEventListener('error', () => {
          if (cancelled) return;
          if (es.readyState === EventSource.CLOSED) {
            onConnState('disconnected');
            es.close();
            const delay = Math.min(1000 * Math.pow(2, retryAttempt), 15_000);
            retryAttempt += 1;
            retryTimer = setTimeout(() => {
              onConnState('reconnecting');
              connect();
            }, delay);
          } else {
            onConnState('reconnecting');
          }
        });
      };

      connect();

      return () => {
        cancelled = true;
        if (retryTimer) clearTimeout(retryTimer);
        currentEs?.close();
      };
    };

    const cleanupLeader = startSseLeader(
      endpoint,
      openConnection,
      handleSnapshot,
      handleConnState
    );

    const staleCheckTimer = setInterval(() => {
      setIsStale((prev) => {
        const next = computeIsStale(
          disconnectedSinceRef.current,
          Date.now(),
          staleAfterMs
        );
        return next === prev ? prev : next;
      });
    }, 5_000);

    return () => {
      clearInterval(staleCheckTimer);
      cleanupLeader();
    };
  }, [endpoint, staleAfterMs]);

  return { orders, connState, lastSync, isStale };
}
