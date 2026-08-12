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
//
// Dédoublonnage multi-onglets : `startSseLeader` (sse-leader.ts) élit un seul
// onglet "leader" par endpoint pour porter la vraie connexion réseau — voir
// ce fichier pour le détail (Web Locks API + BroadcastChannel, fallback
// gracieux si absents).

import { useCallback, useEffect, useRef, useState } from 'react';
import { startSseLeader, type OpenSseConnection } from './sse-leader';

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
   * Durée sans connexion active à partir de laquelle `isStale` passe à `true`
   * (voir `computeIsStale`). Défaut : `DEFAULT_STALE_AFTER_MS`.
   */
  staleAfterMs?: number;
};

export type UseOrdersStreamResult<T> = {
  orders: T[];
  connState: ConnState;
  lastSync: Date | null;
  /**
   * `true` quand la connexion est coupée depuis au moins `staleAfterMs` : les
   * données affichées peuvent être obsolètes, au-delà d'un simple hoquet
   * réseau déjà couvert par le premier cycle de reconnexion.
   */
  isStale: boolean;
};

export const DEFAULT_STALE_AFTER_MS = 30_000;

/**
 * Fonction pure (testable sans monter le hook, cf. `use-orders-stream.test.ts`) :
 * calcule si la donnée doit être considérée périmée à partir de l'instant de
 * la dernière coupure connue (`null` = connecté ou jamais déconnecté).
 */
export function computeIsStale(
  disconnectedSinceMs: number | null,
  nowMs: number,
  staleAfterMs: number = DEFAULT_STALE_AFTER_MS
): boolean {
  return (
    disconnectedSinceMs !== null && nowMs - disconnectedSinceMs >= staleAfterMs
  );
}

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
    // Reçoit un snapshot déjà désérialisé (JSON.parse fait une seule fois,
    // dans `openConnection` — sur l'onglet leader uniquement ; les followers
    // reçoivent l'array déjà structuré via `BroadcastChannel`, pas une chaîne
    // à re-parser).
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

    // Appelé aussi bien pour l'état de connexion RÉEL (onglet leader) que
    // pour l'état RELAYÉ par le leader (onglet follower, cf. `sse-leader.ts`)
    // — un follower ne doit jamais afficher "connecté" pendant que le leader
    // se reconnecte.
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

    // Ouvre la vraie connexion réseau — appelé UNIQUEMENT sur l'onglet élu
    // leader par `startSseLeader` (ou sur tous les onglets en fallback si la
    // Web Locks API est absente, cf. `sse-leader.ts`).
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
            // Backoff exponentiel borné : 1s, 2s, 4s, 8s, 15s max — PAS de
            // limite au nombre de tentatives, un poste de caisse doit
            // continuer à réessayer indéfiniment (ne jamais abandonner
            // silencieusement).
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

    // Vérifie régulièrement si la coupure en cours dépasse `staleAfterMs` —
    // notion temporelle dérivée de la connexion, distincte de `connState`
    // (cf. `computeIsStale`). Coût négligeable même quand `connState ===
    // 'connected'` (une comparaison entière toutes les 5s) ; à ne pas
    // confondre avec le heartbeat serveur anti-buffering proxy (20s, côté
    // route SSE), mécanisme totalement différent.
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
 * Carillon DISTINCT signalant qu'une commande passe « prête » (cuisine →
 * caisse) — un arpège ascendant majeur (do-mi-sol-do), volontairement
 * différent du carillon « nouvelle commande » pour que la caisse le reconnaisse
 * à l'oreille sans regarder l'écran. No-op côté serveur / sans AudioContext.
 */
export function playReadyChime() {
  if (typeof window === 'undefined') return;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return;
  const ctx = new AudioCtx();
  const notes: Array<{ freq: number; start: number; duration: number }> = [
    { freq: 523.25, start: 0, duration: 0.14 }, // do
    { freq: 659.25, start: 0.14, duration: 0.14 }, // mi
    { freq: 783.99, start: 0.28, duration: 0.14 }, // sol
    { freq: 1046.5, start: 0.42, duration: 0.32 }, // do aigu
  ];
  const now = ctx.currentTime;
  for (const note of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
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
