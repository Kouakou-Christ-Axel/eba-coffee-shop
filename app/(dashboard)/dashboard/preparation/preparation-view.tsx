'use client';

import { useState, useEffect, useTransition, useRef, useMemo } from 'react';
import {
  format,
  formatDistanceToNowStrict,
  isPast,
  differenceInMinutes,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Bell,
  BellOff,
  Bike,
  Check,
  Coffee,
  ShoppingBag,
  X,
  Clock,
  Phone,
  StickyNote,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  markOrderReady,
  cancelOrderFromKitchen,
  requestDriver,
} from './actions';
import { type PreparationOrder } from '@/lib/preparation-queue';
import { PreparationQueueList } from './preparation-queue-list';
import type { OrderType } from '@/generated/prisma/client';

const ORDER_TYPE_META: Record<OrderType, { label: string; Icon: typeof Bike }> =
  {
    DELIVERY: { label: 'Livraison', Icon: Bike },
    DINE_IN: { label: 'Sur place', Icon: Coffee },
    TAKEAWAY: { label: 'À emporter', Icon: ShoppingBag },
  };

const SOUND_STORAGE_KEY = 'eba.preparation.sound-enabled';
const SSE_URL = '/api/preparation/stream';

const priceFormatter = new Intl.NumberFormat('fr-FR');

// Payload SSE : pickupTime et createdAt arrivent en chaîne ISO.
type RawOrder = Omit<PreparationOrder, 'pickupTime' | 'createdAt'> & {
  pickupTime: string | null;
  createdAt: string;
};

function normalizeOrder(raw: RawOrder): PreparationOrder {
  return {
    ...raw,
    pickupTime: raw.pickupTime ? new Date(raw.pickupTime) : null,
    createdAt: new Date(raw.createdAt),
  };
}

type ConnState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

function playNewOrderChime() {
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

export function PreparationView({
  initialQueue,
}: {
  initialQueue: PreparationOrder[];
}) {
  const [queue, setQueue] = useState<PreparationOrder[]>(initialQueue);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialQueue[0]?.id ?? null
  );
  const [connState, setConnState] = useState<ConnState>('connecting');
  const [isPending, startTransition] = useTransition();
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const knownIdsRef = useRef<Set<string>>(
    new Set(initialQueue.map((o) => o.id))
  );
  const soundEnabledRef = useRef(true);
  const selectedIdRef = useRef<string | null>(selectedId);

  // Garde la ref synchronisée avec l'état pour les handlers SSE
  // (effet monté une seule fois avec deps `[]`).
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    const saved = localStorage.getItem(SOUND_STORAGE_KEY);
    if (saved === 'false') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from localStorage
      setSoundEnabled(false);
      soundEnabledRef.current = false;
    }
  }, []);

  function toggleSound() {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundEnabledRef.current = next;
    localStorage.setItem(SOUND_STORAGE_KEY, String(next));
    if (next) playNewOrderChime();
  }

  // ── SSE : connexion + auto-reconnexion sur CLOSED ────────────────────────
  // EventSource ne reconnecte pas tout seul après un CLOSED (ex. 401 transitoire
  // ou hot-reload du dev server). On gère la reconnexion à la main avec backoff.
  useEffect(() => {
    let currentEs: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let retryAttempt = 0;
    let cancelled = false;

    const handleQueue = (e: MessageEvent) => {
      let raw: RawOrder[];
      try {
        raw = JSON.parse(e.data) as RawOrder[];
      } catch {
        return;
      }
      const fresh = raw.map(normalizeOrder);

      const newOrders = fresh.filter((o) => !knownIdsRef.current.has(o.id));
      if (newOrders.length > 0 && soundEnabledRef.current) {
        playNewOrderChime();
      }
      knownIdsRef.current = new Set(fresh.map((o) => o.id));

      setQueue(fresh);

      const currentSelected = selectedIdRef.current;
      const stillPresent =
        currentSelected !== null && fresh.some((o) => o.id === currentSelected);
      if (!stillPresent) {
        const next = fresh[0]?.id ?? null;
        setSelectedId(next);
        selectedIdRef.current = next;
      }

      setLastSync(new Date());
    };

    const connect = () => {
      if (cancelled) return;
      const es = new EventSource(SSE_URL);
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
  }, []);

  const current = useMemo(
    () => queue.find((o) => o.id === selectedId) ?? queue[0] ?? null,
    [queue, selectedId]
  );
  const currentIndex = current
    ? queue.findIndex((o) => o.id === current.id)
    : -1;

  function pickNextSelection(removedIndex: number, list: PreparationOrder[]) {
    return list[removedIndex + 1]?.id ?? list[removedIndex - 1]?.id ?? null;
  }

  function handleReady() {
    if (!current || isPending) return;
    const id = current.id;
    const nextId = pickNextSelection(currentIndex, queue);

    // Retrait optimiste + sélection suivante (mises à jour parallèles)
    setQueue((prev) => prev.filter((o) => o.id !== id));
    setSelectedId(nextId);
    selectedIdRef.current = nextId;

    startTransition(async () => {
      try {
        await markOrderReady(id);
      } catch (err) {
        console.error('[preparation] markOrderReady échoué :', err);
        // Le prochain snapshot SSE réconciliera automatiquement.
      }
    });
  }

  function handleRequestDriver() {
    if (!current || isPending || current.driverRequested) return;
    const id = current.id;
    startTransition(async () => {
      try {
        await requestDriver(id);
      } catch (err) {
        console.error('[preparation] requestDriver échoué :', err);
      }
    });
  }

  function handleCancel() {
    if (!current || isPending) return;
    if (!confirm(`Annuler la commande ${current.reference} ?`)) return;
    const id = current.id;
    const nextId = pickNextSelection(currentIndex, queue);

    setQueue((prev) => prev.filter((o) => o.id !== id));
    setSelectedId(nextId);
    selectedIdRef.current = nextId;

    startTransition(async () => {
      try {
        await cancelOrderFromKitchen(id);
      } catch (err) {
        console.error('[preparation] cancelOrderFromKitchen échoué :', err);
      }
    });
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col">
      {/* ── En-tête ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">
            Commande
          </span>
          {current ? (
            <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">
              {currentIndex + 1} / {queue.length}
            </span>
          ) : (
            <span className="rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground">
              0 / 0
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <ConnectionBadge state={connState} />
          {lastSync && (
            <span className="hidden text-xs text-muted-foreground sm:inline">
              Synchro à {format(lastSync, 'HH:mm:ss')}
            </span>
          )}
          <button
            type="button"
            onClick={toggleSound}
            aria-label={
              soundEnabled
                ? 'Désactiver le son des nouvelles commandes'
                : 'Activer le son des nouvelles commandes'
            }
            title={soundEnabled ? 'Son activé' : 'Son désactivé'}
            className={cn(
              'rounded-full p-2 transition-colors',
              soundEnabled
                ? 'bg-primary/10 text-primary hover:bg-primary/20'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {soundEnabled ? (
              <Bell className="h-4 w-4" />
            ) : (
              <BellOff className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* ── Corps : 2 colonnes sur lg, empilé sinon ─────────────────────── */}
      <div className="grid flex-1 grid-cols-1 gap-4 pt-4 lg:grid-cols-[1fr_360px] lg:gap-6">
        {/* Colonne gauche : détail de la commande sélectionnée */}
        <div className="flex min-h-0 flex-col">
          {current ? (
            <OrderDetail
              order={current}
              isPending={isPending}
              onReady={handleReady}
              onCancel={handleCancel}
              onRequestDriver={handleRequestDriver}
            />
          ) : (
            <EmptyState />
          )}
        </div>

        {/* Colonne droite : file d'attente */}
        <aside className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-6rem)] lg:self-start">
          <PreparationQueueList
            orders={queue}
            selectedId={current?.id ?? null}
            onSelect={(id) => {
              setSelectedId(id);
              selectedIdRef.current = id;
            }}
          />
        </aside>
      </div>
    </div>
  );
}

// ─── Sous-composants ─────────────────────────────────────────────────────

function ConnectionBadge({ state }: { state: ConnState }) {
  const config = {
    connecting: {
      label: 'Connexion…',
      dotClass: 'bg-muted-foreground animate-pulse',
      Icon: Wifi,
    },
    connected: {
      label: 'En direct',
      dotClass: 'bg-green-500',
      Icon: Wifi,
    },
    reconnecting: {
      label: 'Reconnexion…',
      dotClass: 'bg-amber-500 animate-pulse',
      Icon: Wifi,
    },
    disconnected: {
      label: 'Hors ligne',
      dotClass: 'bg-red-500',
      Icon: WifiOff,
    },
  }[state];

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
      title={config.label}
    >
      <span className={cn('h-2 w-2 rounded-full', config.dotClass)} />
      <span className="hidden sm:inline">{config.label}</span>
    </span>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border bg-card py-12 text-center">
      <div className="rounded-full bg-green-100 p-6 dark:bg-green-950">
        <Check className="h-16 w-16 text-green-600 dark:text-green-400" />
      </div>
      <h1 className="text-3xl font-bold">Aucune commande en cuisine</h1>
      <p className="max-w-md text-base text-muted-foreground">
        Les commandes apparaissent ici dès qu&apos;elles sont encaissées par la
        caisse, ou envoyées en cuisine manuellement.
      </p>
    </div>
  );
}

function OrderDetail({
  order,
  isPending,
  onReady,
  onCancel,
  onRequestDriver,
}: {
  order: PreparationOrder;
  isPending: boolean;
  onReady: () => void;
  onCancel: () => void;
  onRequestDriver: () => void;
}) {
  const pickup = order.pickupTime;
  const typeMeta = ORDER_TYPE_META[order.orderType];
  const TypeIcon = typeMeta.Icon;
  const isDelivery = order.orderType === 'DELIVERY';
  const minutesUntil = pickup ? differenceInMinutes(pickup, new Date()) : null;
  const isLate = pickup ? isPast(pickup) : false;
  const isSoon = pickup ? !isLate && (minutesUntil ?? 0) <= 15 : false;

  const pickupRelative = pickup
    ? isLate
      ? `En retard de ${formatDistanceToNowStrict(pickup, { locale: fr })}`
      : `Dans ${formatDistanceToNowStrict(pickup, { locale: fr })}`
    : 'Walk-in';

  return (
    <>
      <div className="flex-1 py-2">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-3xl font-bold tracking-tight">
              #{String(order.dailyNumber).padStart(3, '0')}
            </p>
            <p className="font-mono text-xs text-muted-foreground">
              {order.reference}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium"
                title={typeMeta.label}
              >
                <TypeIcon className="h-3.5 w-3.5" />
                {typeMeta.label}
              </span>
              {!order.isPaid && (
                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-900 dark:bg-orange-950 dark:text-orange-100">
                  À encaisser après
                </span>
              )}
            </div>
            <p className="mt-2 text-2xl font-semibold">
              {order.customerName ?? 'Client anonyme'}
            </p>
            {order.customerPhone && (
              <a
                href={`tel:${order.customerPhone}`}
                className="mt-1 inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <Phone className="h-4 w-4" />
                {order.customerPhone}
              </a>
            )}
          </div>

          <div
            className={cn(
              'flex flex-col items-end rounded-xl px-5 py-3',
              isLate
                ? 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100'
                : isSoon
                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100'
                  : 'bg-muted'
            )}
          >
            <div className="flex items-center gap-2 text-4xl font-bold tabular-nums">
              <Clock className="h-7 w-7" />
              {pickup ? format(pickup, 'HH:mm', { locale: fr }) : '—'}
            </div>
            <p className="mt-1 text-sm font-medium">{pickupRelative}</p>
          </div>
        </div>

        {order.note && (
          <div className="mb-6 flex gap-2 rounded-lg border-l-4 border-amber-500 bg-amber-50 p-4 dark:bg-amber-950/40">
            <StickyNote className="h-5 w-5 flex-shrink-0 text-amber-600" />
            <p className="text-base font-medium text-amber-900 dark:text-amber-100">
              {order.note}
            </p>
          </div>
        )}

        {isDelivery && (
          <div className="mb-6">
            <button
              type="button"
              onClick={onRequestDriver}
              disabled={isPending || order.driverRequested}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-xl border-2 py-3 text-base font-semibold transition-colors',
                order.driverRequested
                  ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100'
                  : 'border-amber-500 bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-950/50 dark:hover:bg-amber-900/40'
              )}
            >
              <Bike className="h-5 w-5" />
              {order.driverRequested
                ? 'Livreur demandé · caisse alertée'
                : 'Demander le livreur maintenant'}
            </button>
          </div>
        )}

        <div className="rounded-xl border bg-card">
          <ul className="divide-y">
            {order.items.map((item) => (
              <li key={item.cartId} className="p-5">
                <div className="flex items-baseline justify-between gap-4">
                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl font-bold tabular-nums text-primary">
                      ×{item.quantity}
                    </span>
                    <span className="text-2xl font-semibold">
                      {item.productName}
                    </span>
                  </div>
                  <span className="text-base text-muted-foreground">
                    {priceFormatter.format(
                      (item.basePrice +
                        item.supplements.reduce((s, sup) => s + sup.price, 0)) *
                        item.quantity
                    )}{' '}
                    FCFA
                  </span>
                </div>
                {item.supplements.length > 0 && (
                  <ul className="mt-2 ml-12 space-y-1">
                    {item.supplements.map((sup, i) => (
                      <li
                        key={i}
                        className="text-lg text-muted-foreground before:mr-2 before:content-['•']"
                      >
                        <span className="font-medium text-foreground">
                          {sup.optionName}
                        </span>
                        <span className="text-sm"> ({sup.groupName})</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
          <div className="flex items-baseline justify-between border-t bg-muted/30 px-5 py-4">
            <span className="text-lg font-semibold uppercase tracking-wider text-muted-foreground">
              Total
            </span>
            <span className="text-3xl font-bold tabular-nums">
              {priceFormatter.format(order.total)}{' '}
              <span className="text-xl text-muted-foreground">FCFA</span>
            </span>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 grid grid-cols-[1fr_3fr] gap-3 border-t bg-background pt-4 pb-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-red-200 bg-red-50 py-6 text-red-700 transition-colors hover:bg-red-100 active:bg-red-200 disabled:opacity-50 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-900/40"
        >
          <X className="h-8 w-8" strokeWidth={2.5} />
          <span className="text-lg font-bold">Annuler</span>
        </button>
        <button
          type="button"
          onClick={onReady}
          disabled={isPending}
          className="flex flex-col items-center justify-center gap-1 rounded-xl bg-green-600 py-6 text-white shadow-lg transition-colors hover:bg-green-700 active:bg-green-800 disabled:opacity-50"
        >
          <Check className="h-10 w-10" strokeWidth={3} />
          <span className="text-2xl font-bold">Commande prête</span>
        </button>
      </div>
    </>
  );
}
