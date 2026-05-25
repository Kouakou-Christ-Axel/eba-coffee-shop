'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, BellOff, Inbox, Plus, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { OrderCard } from './order-card';
import { OrderCardActions } from './order-card-actions';
import type { CashierOrder } from '@/lib/cashier-queue';

const SSE_URL = '/api/caisse/stream';
const SOUND_STORAGE_KEY = 'eba.caisse.sound-enabled';

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
type TabKey = 'to-pay' | 'in-progress' | 'ready';

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

  // SSE : une seule connexion pour toute la durée de vie
  useEffect(() => {
    const es = new EventSource(SSE_URL);

    const handleOpen = () => setConnState('connected');

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

    const handleError = () => {
      setConnState(
        es.readyState === EventSource.CLOSED ? 'disconnected' : 'reconnecting'
      );
    };

    es.addEventListener('open', handleOpen);
    es.addEventListener('queue', handleQueue);
    es.addEventListener('error', handleError);

    return () => {
      es.removeEventListener('open', handleOpen);
      es.removeEventListener('queue', handleQueue);
      es.removeEventListener('error', handleError);
      es.close();
    };
  }, []);

  const counts = useMemo(
    () => ({
      'to-pay': filterByTab(queue, 'to-pay').length,
      'in-progress': filterByTab(queue, 'in-progress').length,
      ready: filterByTab(queue, 'ready').length,
    }),
    [queue]
  );

  const visibleOrders = useMemo(() => filterByTab(queue, tab), [queue, tab]);

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

      {/* Tabs */}
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as TabKey)}
        className="flex-1"
      >
        <TabsList className="w-full">
          <TabsTrigger value="to-pay" className="flex-1 gap-1.5">
            À encaisser
            <CountBadge value={counts['to-pay']} />
          </TabsTrigger>
          <TabsTrigger value="in-progress" className="flex-1 gap-1.5">
            En cours
            <CountBadge value={counts['in-progress']} muted />
          </TabsTrigger>
          <TabsTrigger value="ready" className="flex-1 gap-1.5">
            Prêtes
            <CountBadge value={counts.ready} muted />
          </TabsTrigger>
        </TabsList>

        {(['to-pay', 'in-progress', 'ready'] as TabKey[]).map((t) => (
          <TabsContent key={t} value={t} className="mt-4">
            <OrderList orders={visibleOrders} tab={t} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function OrderList({ orders, tab }: { orders: CashierOrder[]; tab: TabKey }) {
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
          actions={<OrderCardActions order={o} />}
        />
      ))}
    </div>
  );
}

function CountBadge({ value, muted }: { value: number; muted?: boolean }) {
  return (
    <span
      className={cn(
        'min-w-5 rounded-full px-1.5 text-xs font-semibold tabular-nums',
        muted
          ? 'bg-muted text-muted-foreground'
          : 'bg-foreground text-background'
      )}
    >
      {value}
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
