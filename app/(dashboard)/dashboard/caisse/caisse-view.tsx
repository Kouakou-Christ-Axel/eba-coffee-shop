'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CashierOrder } from '@/lib/cashier-queue';
import type { MenuCategory } from '@/config/menu';
import {
  playNewOrderChime,
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

type RawCashierOrder = Omit<CashierOrder, 'pickupTime' | 'createdAt'> & {
  pickupTime: string | null;
  createdAt: string;
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
