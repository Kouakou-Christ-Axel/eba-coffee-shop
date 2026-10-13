'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import type { CashierOrder } from '@/lib/cashier-queue';
import type { OrderStatus } from '@/generated/prisma/client';
import {
  playNewOrderChime,
  playReadyChime,
} from '@/lib/hooks/use-orders-stream';
import { SCHEDULED_ALERT_MINUTES } from '@/config/constants';
import { minutesUntilPickup } from '../../urgency';
import type { useUrgencyCounts } from '../use-urgency-counts';

const CHIME_REPEAT_MS = 3 * 60_000;

export function useCaisseAlerts({
  initialQueue,
  queue,
  now,
  urgencyIndex,
  soundEnabledRef,
}: {
  initialQueue: CashierOrder[];
  queue: CashierOrder[];
  now: Date;
  urgencyIndex: ReturnType<typeof useUrgencyCounts>['urgencyIndex'];
  soundEnabledRef: RefObject<boolean>;
}) {
  const lastChimedAtRef = useRef<Map<string, number>>(new Map());
  // Commandes programmées déjà signalées à l'approche du retrait (carillon unique à −15 min).
  const scheduledAlertedRef = useRef<Set<string>>(new Set());
  // Amorcé depuis le snapshot initial pour ne pas notifier au premier rendu.
  const prevStatusRef = useRef<Map<string, OrderStatus>>(
    new Map(initialQueue.map((o) => [o.id, o.status]))
  );
  const readyFlashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  // Commandes qui viennent de passer « prête » : bandeau éphémère en caisse.
  const [readyFlash, setReadyFlash] = useState<number[] | null>(null);

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

  return { readyFlash, setReadyFlash };
}
