'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Bell,
  BellOff,
  Inbox,
  Plus,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { OrderCard } from './order-card';
import { OrderCardActions } from './order-card-actions';
import type { CashierOrder } from '@/lib/cashier-queue';
import {
  getUrgencyLevel,
  pickFirstCriticalTab,
  type TabKey,
  type UrgencyLevel,
} from './urgency';
import { useNowTick } from './use-now-tick';

const SSE_URL = '/api/caisse/stream';
const SOUND_STORAGE_KEY = 'eba.caisse.sound-enabled';
const CHIME_REPEAT_MS = 3 * 60_000;

type RawCashierOrder = Omit<CashierOrder, 'pickupTime' | 'createdAt'> & {
  pickupTime: string | null;
  createdAt: string;
};

function normalize(raw: RawCashierOrder): CashierOrder {
  return {
    ...raw,
    pickupTime: raw.pickupTime ? new Date(raw.pickupTime) : null,
    createdAt: new Date(raw.createdAt),
  };
}

type ConnState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

function filterByTab(orders: CashierOrder[], tab: TabKey): CashierOrder[] {
  switch (tab) {
    case 'to-pay':
      return orders.filter(
        (o) => !o.isPaid && o.status !== 'COMPLETED' && o.status !== 'CANCELLED'
      );
    case 'in-progress':
      return orders.filter((o) => o.status === 'PREPARING');
    case 'ready':
      return orders.filter((o) => o.status === 'READY');
  }
}

const URGENCY_ORDER: UrgencyLevel[] = [
  'normal',
  'attention',
  'alert',
  'critical',
];

function maxUrgency(
  order: CashierOrder,
  now: Date
): { level: UrgencyLevel; tabs: TabKey[] } {
  const tabs: TabKey[] = [];
  if (
    !order.isPaid &&
    order.status !== 'COMPLETED' &&
    order.status !== 'CANCELLED'
  ) {
    tabs.push('to-pay');
  }
  if (order.status === 'PREPARING') tabs.push('in-progress');
  if (order.status === 'READY') tabs.push('ready');

  if (tabs.length === 0) return { level: 'normal', tabs };

  let max: UrgencyLevel = 'normal';
  for (const t of tabs) {
    const lvl = getUrgencyLevel(order, t, now);
    if (URGENCY_ORDER.indexOf(lvl) > URGENCY_ORDER.indexOf(max)) max = lvl;
  }
  return { level: max, tabs };
}

function playNewOrderChime() {
  if (typeof window === 'undefined') return;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return;
  const ctx = new AudioCtx();
  const notes = [
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

export function CaisseView({
  initialQueue,
  cashierName,
}: {
  initialQueue: CashierOrder[];
  cashierName: string;
}) {
  const [queue, setQueue] = useState<CashierOrder[]>(initialQueue);
  const [connState, setConnState] = useState<ConnState>('connecting');
  const [tab, setTab] = useState<TabKey>('to-pay');
  const [soundEnabled, setSoundEnabled] = useState(true);

  const knownIdsRef = useRef<Set<string>>(
    new Set(initialQueue.map((o) => o.id))
  );
  const soundEnabledRef = useRef(true);
  const lastChimedAtRef = useRef<Map<string, number>>(new Map());

  const now = useNowTick(30_000);

  // Hydratation préférence son depuis localStorage
  useEffect(() => {
    const saved = localStorage.getItem(SOUND_STORAGE_KEY);
    if (saved === 'false') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration
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

  // SSE : connexion + auto-reconnexion sur CLOSED (backoff exponentiel borné).
  useEffect(() => {
    let currentEs: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let retryAttempt = 0;
    let cancelled = false;

    const handleQueue = (e: MessageEvent) => {
      let raw: RawCashierOrder[];
      try {
        raw = JSON.parse(e.data) as RawCashierOrder[];
      } catch {
        return;
      }
      const fresh = raw.map(normalize);

      const newOrders = fresh.filter((o) => !knownIdsRef.current.has(o.id));
      if (newOrders.length > 0 && soundEnabledRef.current) {
        playNewOrderChime();
      }
      knownIdsRef.current = new Set(fresh.map((o) => o.id));

      setQueue(fresh);
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

  // Index des urgences calculées (recalculé à chaque tick ou changement de queue).
  const urgencyIndex = useMemo(() => {
    const map = new Map<string, { level: UrgencyLevel; tabs: TabKey[] }>();
    for (const o of queue) {
      map.set(o.id, maxUrgency(o, now));
    }
    return map;
  }, [queue, now]);

  // Compteurs par tab : total + critical.
  const counts = useMemo(() => {
    const result: Record<TabKey, { total: number; critical: number }> = {
      'to-pay': { total: 0, critical: 0 },
      'in-progress': { total: 0, critical: 0 },
      ready: { total: 0, critical: 0 },
    };
    for (const o of queue) {
      const tabs = urgencyIndex.get(o.id)?.tabs ?? [];
      for (const t of tabs) {
        result[t].total += 1;
        const lvl = getUrgencyLevel(o, t, now);
        if (lvl === 'critical') result[t].critical += 1;
      }
    }
    return result;
  }, [queue, urgencyIndex, now]);

  const criticalTotal =
    counts['to-pay'].critical +
    counts['in-progress'].critical +
    counts.ready.critical;

  // Carillon récurrent : à chaque tick, alerter pour chaque commande critique
  // qui n'a pas été alertée depuis CHIME_REPEAT_MS.
  useEffect(() => {
    if (!soundEnabledRef.current) return;
    const map = lastChimedAtRef.current;
    const nowMs = now.getTime();
    const liveIds = new Set(queue.map((o) => o.id));

    // Nettoyage : commandes qui ne sont plus dans la queue
    for (const id of map.keys()) {
      if (!liveIds.has(id)) map.delete(id);
    }

    let shouldChime = false;
    for (const o of queue) {
      if (urgencyIndex.get(o.id)?.level !== 'critical') {
        // Reset compteur si la commande sort du critique (action faite)
        map.delete(o.id);
        continue;
      }
      const last = map.get(o.id);
      if (last === undefined || nowMs - last >= CHIME_REPEAT_MS) {
        map.set(o.id, nowMs);
        shouldChime = true;
      }
    }
    if (shouldChime) playNewOrderChime();
  }, [now, queue, urgencyIndex]);

  const visibleOrders = useMemo(() => filterByTab(queue, tab), [queue, tab]);

  function handleBannerSeeClick() {
    const criticals: Record<TabKey, number> = {
      'to-pay': counts['to-pay'].critical,
      'in-progress': counts['in-progress'].critical,
      ready: counts.ready.critical,
    };
    const target = pickFirstCriticalTab(criticals);
    if (target) setTab(target);
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col gap-4">
      {/* Header */}
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Caisse · {cashierName}
          </p>
          <h1 className="truncate text-2xl font-bold">eba coffee</h1>
        </div>
        <div className="flex items-center gap-2">
          <ConnectionBadge state={connState} />
          <button
            type="button"
            onClick={toggleSound}
            aria-label={soundEnabled ? 'Désactiver le son' : 'Activer le son'}
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
          <Link
            href="/dashboard/caisse/new"
            aria-label="Nouvelle commande"
            className="rounded-full bg-primary p-2 text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
          </Link>
        </div>
      </header>

      {/* Bandeau d'urgence cross-onglet */}
      {criticalTotal > 0 && (
        <AlertBanner
          counts={counts}
          activeTab={tab}
          onSeeClick={handleBannerSeeClick}
        />
      )}

      {/* Tabs */}
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as TabKey)}
        className="flex-1"
      >
        <TabsList className="w-full">
          <TabsTrigger value="to-pay" className="flex-1 gap-1.5">
            À encaisser
            <CountBadge
              value={counts['to-pay'].total}
              criticalCount={counts['to-pay'].critical}
            />
          </TabsTrigger>
          <TabsTrigger value="in-progress" className="flex-1 gap-1.5">
            En cours
            <CountBadge
              value={counts['in-progress'].total}
              criticalCount={counts['in-progress'].critical}
              muted
            />
          </TabsTrigger>
          <TabsTrigger value="ready" className="flex-1 gap-1.5">
            Prêtes
            <CountBadge
              value={counts.ready.total}
              criticalCount={counts.ready.critical}
              muted
            />
          </TabsTrigger>
        </TabsList>

        {(['to-pay', 'in-progress', 'ready'] as TabKey[]).map((t) => (
          <TabsContent key={t} value={t} className="mt-4">
            <OrderList orders={visibleOrders} tab={t} now={now} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function OrderList({
  orders,
  tab,
  now,
}: {
  orders: CashierOrder[];
  tab: TabKey;
  now: Date;
}) {
  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border bg-card p-8 text-center text-muted-foreground">
        <Inbox className="h-8 w-8" />
        <p className="text-sm font-medium">
          {tab === 'to-pay' && 'Aucune commande à encaisser'}
          {tab === 'in-progress' && 'Aucune commande en cours'}
          {tab === 'ready' && 'Aucune commande prête'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {orders.map((o) => (
        <OrderCard
          key={o.id}
          order={o}
          urgency={getUrgencyLevel(o, tab, now)}
          now={now}
          actions={<OrderCardActions order={o} />}
        />
      ))}
    </div>
  );
}

function AlertBanner({
  counts,
  activeTab,
  onSeeClick,
}: {
  counts: Record<TabKey, { total: number; critical: number }>;
  activeTab: TabKey;
  onSeeClick: () => void;
}) {
  const parts: string[] = [];
  if (counts['to-pay'].critical > 0)
    parts.push(`${counts['to-pay'].critical} à encaisser`);
  if (counts.ready.critical > 0)
    parts.push(
      `${counts.ready.critical} prête${counts.ready.critical > 1 ? 's' : ''}`
    );
  if (counts['in-progress'].critical > 0)
    parts.push(`${counts['in-progress'].critical} en cours`);

  const targetCriticals: Record<TabKey, number> = {
    'to-pay': counts['to-pay'].critical,
    'in-progress': counts['in-progress'].critical,
    ready: counts.ready.critical,
  };
  const target = pickFirstCriticalTab(targetCriticals);
  const showSeeButton = target !== null && target !== activeTab;

  return (
    <div
      role="alert"
      className="animate-in slide-in-from-top-2 fade-in-0 flex items-center gap-2 rounded-xl border-2 border-red-300 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100"
    >
      <AlertTriangle
        className="h-5 w-5 shrink-0 animate-pulse"
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        <p className="font-semibold">Action urgente</p>
        <p className="text-xs">{parts.join(' · ')} ont dépassé le seuil</p>
      </div>
      {showSeeButton && (
        <button
          type="button"
          onClick={onSeeClick}
          className="shrink-0 rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-red-700"
        >
          Voir
        </button>
      )}
    </div>
  );
}

function CountBadge({
  value,
  criticalCount,
  muted,
}: {
  value: number;
  criticalCount: number;
  muted?: boolean;
}) {
  const hasCritical = criticalCount > 0;
  return (
    <span
      className={cn(
        'relative min-w-5 rounded-full px-1.5 text-xs font-semibold tabular-nums',
        hasCritical
          ? 'bg-red-600 text-white'
          : muted
            ? 'bg-muted text-muted-foreground'
            : 'bg-foreground text-background'
      )}
    >
      {value}
      {hasCritical && (
        <span
          className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-background animate-pulse"
          aria-label={`${criticalCount} critique${criticalCount > 1 ? 's' : ''}`}
        />
      )}
    </span>
  );
}

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
