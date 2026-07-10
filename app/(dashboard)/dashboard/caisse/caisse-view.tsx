'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { PackageCheck, X } from 'lucide-react';
import type { CashierOrder } from '@/lib/cashier-queue';
import type { MenuCategory } from '@/config/menu';
import type { OrderStatus } from '@/generated/prisma/client';
import {
  playNewOrderChime,
  playReadyChime,
  useOrdersStream,
  useSoundPreference,
} from '@/lib/hooks/use-orders-stream';
import { normalizeOrderDates } from '@/lib/orders/format';
import {
  minutesUntilPickup,
  pickFirstCriticalTab,
  type TabKey,
} from './urgency';
import { useNowTick } from './use-now-tick';
import { CaisseHeader } from './_components/caisse-header';
import { AlertBanner } from './_components/alert-banner';
import { ScheduledSection } from './_components/scheduled-section';
import { UrgencyTabs } from './_components/urgency-tabs';
import {
  filterByTab,
  filterScheduledAhead,
  useUrgencyCounts,
} from './_components/use-urgency-counts';
import { SCHEDULED_ALERT_MINUTES } from '@/config/constants';

const SSE_URL = '/api/caisse/stream';
const SOUND_STORAGE_KEY = 'eba.caisse.sound-enabled';
const CHIME_REPEAT_MS = 3 * 60_000;

type RawCashierOrder = Omit<
  CashierOrder,
  'pickupTime' | 'createdAt' | 'preparingStartedAt' | 'readyAt'
> & {
  pickupTime: string | null;
  createdAt: string;
  preparingStartedAt: string | null;
  readyAt: string | null;
};

function normalize(raw: unknown): CashierOrder {
  return normalizeOrderDates(raw as RawCashierOrder);
}

export function CaisseView({
  initialQueue,
  menu,
  cashierName,
}: {
  initialQueue: CashierOrder[];
  menu: MenuCategory[];
  cashierName: string;
}) {
  const [tab, setTab] = useState<TabKey>('to-pay');
  const { soundEnabled, soundEnabledRef, toggleSound } =
    useSoundPreference(SOUND_STORAGE_KEY);
  const lastChimedAtRef = useRef<Map<string, number>>(new Map());
  // Commandes programmées déjà signalées à l'approche du retrait (carillon unique à −15 min).
  const scheduledAlertedRef = useRef<Set<string>>(new Set());
  // Statut précédent de chaque commande, pour détecter le passage → READY
  // (cuisine → caisse) et déclencher une notification DISTINCTE. Amorcé depuis
  // le snapshot initial pour ne pas notifier au premier rendu.
  const prevStatusRef = useRef<Map<string, OrderStatus>>(
    new Map(initialQueue.map((o) => [o.id, o.status]))
  );
  const readyFlashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  // Commandes qui viennent de passer « prête » : bandeau éphémère en caisse.
  const [readyFlash, setReadyFlash] = useState<number[] | null>(null);

  const now = useNowTick(30_000);

  const { orders: queue, connState } = useOrdersStream<CashierOrder>({
    endpoint: SSE_URL,
    initialOrders: initialQueue,
    normalize,
    getId: (o) => o.id,
    onNewOrders: (newOrders) => {
      if (!soundEnabledRef.current) return;
      // On ne carillonne à l'arrivée que pour les commandes « immédiates ».
      // Les programmées (retrait lointain) ne sonneront qu'à −SCHEDULED_ALERT_MINUTES.
      const arrivedNow = new Date();
      const hasImmediate = newOrders.some((o) => {
        const m = minutesUntilPickup(o, arrivedNow);
        return m === null || m <= SCHEDULED_ALERT_MINUTES;
      });
      if (hasImmediate) playNewOrderChime();
    },
  });

  const { urgencyIndex, counts } = useUrgencyCounts(queue, now);

  const criticalTotal =
    counts['to-pay'].critical +
    counts['in-progress'].critical +
    counts.ready.critical;

  // Carillon récurrent pour chaque commande critique non alertée depuis CHIME_REPEAT_MS.
  useEffect(() => {
    if (!soundEnabledRef.current) return;
    const map = lastChimedAtRef.current;
    const nowMs = now.getTime();
    const liveIds = new Set(queue.map((o) => o.id));

    for (const id of map.keys()) {
      if (!liveIds.has(id)) map.delete(id);
    }

    let shouldChime = false;
    for (const o of queue) {
      if (urgencyIndex.get(o.id)?.level !== 'critical') {
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
  }, [now, queue, urgencyIndex, soundEnabledRef]);

  // Carillon unique au passage sous −SCHEDULED_ALERT_MINUTES d'une commande programmée.
  useEffect(() => {
    const alerted = scheduledAlertedRef.current;
    const liveIds = new Set(queue.map((o) => o.id));
    for (const id of alerted) {
      if (!liveIds.has(id)) alerted.delete(id);
    }

    let shouldChime = false;
    for (const o of queue) {
      if (o.status !== 'NEW' && o.status !== 'PREPARING') continue;
      const m = minutesUntilPickup(o, now);
      if (m === null || m > SCHEDULED_ALERT_MINUTES || m <= 0) continue;
      if (!alerted.has(o.id)) {
        alerted.add(o.id);
        shouldChime = true;
      }
    }
    if (shouldChime && soundEnabledRef.current) playNewOrderChime();
  }, [now, queue, soundEnabledRef]);

  // Notification DISTINCTE « Commande prête » : la cuisine a marqué une commande
  // prête (→ READY). On compare au statut précédent pour ne réagir qu'à la
  // transition (jamais au chargement ni à un simple re-render). Carillon dédié
  // + bandeau éphémère.
  useEffect(() => {
    const prev = prevStatusRef.current;
    const newlyReady: CashierOrder[] = [];
    for (const o of queue) {
      const before = prev.get(o.id);
      if (before !== undefined && before !== 'READY' && o.status === 'READY') {
        newlyReady.push(o);
      }
    }
    prevStatusRef.current = new Map(queue.map((o) => [o.id, o.status]));

    if (newlyReady.length > 0) {
      if (soundEnabledRef.current) playReadyChime();
      // Réaction à un changement du flux SSE externe (transition → READY) : le
      // setState est intentionnel ici (notification en direct), pas un dérivé
      // d'état recalculable pendant le rendu.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReadyFlash(newlyReady.map((o) => o.dailyNumber));
      if (readyFlashTimer.current) clearTimeout(readyFlashTimer.current);
      readyFlashTimer.current = setTimeout(() => setReadyFlash(null), 10_000);
    }
  }, [queue, soundEnabledRef]);

  useEffect(
    () => () => {
      if (readyFlashTimer.current) clearTimeout(readyFlashTimer.current);
    },
    []
  );

  const scheduledOrders = useMemo(
    () => filterScheduledAhead(queue, now),
    [queue, now]
  );

  const visibleOrders = useMemo(
    () => filterByTab(queue, tab, now),
    [queue, tab, now]
  );

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
      <CaisseHeader
        cashierName={cashierName}
        connState={connState}
        soundEnabled={soundEnabled}
        onToggleSound={toggleSound}
      />

      {readyFlash && readyFlash.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl border-2 border-green-300 bg-green-50 px-4 py-3 text-green-900 shadow-sm dark:border-green-800 dark:bg-green-950/40 dark:text-green-100">
          <PackageCheck className="h-6 w-6 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">
              {readyFlash.length > 1
                ? `${readyFlash.length} commandes prêtes !`
                : 'Commande prête !'}
            </p>
            <p className="truncate text-xs">
              {readyFlash
                .map((n) => `#${String(n).padStart(3, '0')}`)
                .join(', ')}{' '}
              — à remettre au client
            </p>
          </div>
          <button
            type="button"
            onClick={() => setReadyFlash(null)}
            aria-label="Fermer"
            className="shrink-0 rounded-full p-1 text-green-700 transition-colors hover:bg-green-100 dark:text-green-300 dark:hover:bg-green-900/40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {criticalTotal > 0 && (
        <AlertBanner
          counts={counts}
          activeTab={tab}
          onSeeClick={handleBannerSeeClick}
        />
      )}

      <ScheduledSection orders={scheduledOrders} menu={menu} now={now} />

      <UrgencyTabs
        tab={tab}
        onTabChange={setTab}
        counts={counts}
        visibleOrders={visibleOrders}
        menu={menu}
        now={now}
      />
    </div>
  );
}
