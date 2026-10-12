'use client';

import { useMemo } from 'react';
import { type PreparationOrder } from '@/lib/preparation-queue';
import {
  isAwaitingKitchenLaunch,
  isScheduledAhead,
  kitchenLaunchState,
} from '@/lib/orders/scheduling';
import { buildProductionPlan } from '@/lib/orders/production-plan';
import { READY_WAIT_ALERT_MINUTES } from '@/config/constants';
import { elapsedMinutes } from '../elapsed';

export function usePreparationLists(
  orders: PreparationOrder[],
  optimisticHidden: Set<string>,
  selectedId: string | null,
  now: Date
) {
  const visible = useMemo(
    () => orders.filter((o) => !optimisticHidden.has(o.id)),
    [orders, optimisticHidden]
  );
  // « À cuisiner maintenant » : en préparation et PAS programmée lointaine.
  const cooking = useMemo(
    () =>
      visible.filter(
        (o) => o.status === 'PREPARING' && !isScheduledAhead(o, now)
      ),
    [visible, now]
  );
  // Programmées, déchargées de la grille : (1) en cuisine à retrait lointain ; (2) `NEW` à créneau pas encore lancées — sans
  // elles, une commande pour demain n'apparaîtrait nulle part en cuisine.
  const scheduled = useMemo(
    () =>
      visible
        .filter(
          (o) =>
            (o.status === 'PREPARING' && isScheduledAhead(o, now)) ||
            isAwaitingKitchenLaunch(o)
        )
        .sort(
          (a, b) =>
            (a.pickupTime?.getTime() ?? 0) - (b.pickupTime?.getTime() ?? 0)
        ),
    [visible, now]
  );
  // « À produire » : en cuisine + programmées non lancées, par jour de retrait ; le flux SSE porte déjà tout.
  const productionPlan = useMemo(
    () => buildProductionPlan(visible, now),
    [visible, now]
  );
  // Créneaux non lancés dont le retrait tombe AUJOURD'HUI : « à lancer » dès l'ouverture (cf. `kitchenLaunchState`), rouge si urgent.
  const { toLaunchCount, toLaunchUrgent } = useMemo(() => {
    const states = scheduled.map((o) => kitchenLaunchState(o, now));
    return {
      toLaunchCount: states.filter((st) => st === 'today' || st === 'now')
        .length,
      toLaunchUrgent: states.includes('now'),
    };
  }, [scheduled, now]);
  const ready = useMemo(
    () => visible.filter((o) => o.status === 'READY'),
    [visible]
  );
  // Ardoise : en cuisine mais non payée ; exclut les NEW programmées (pas physiquement présentes).
  const toPay = useMemo(
    () => visible.filter((o) => !o.isPaid && o.status !== 'NEW'),
    [visible]
  );
  const readyAlert = useMemo(
    () =>
      ready.some(
        (o) =>
          elapsedMinutes(o.readyAt ?? o.createdAt, now) >=
          READY_WAIT_ALERT_MINUTES
      ),
    [ready, now]
  );
  // Commande agrandie, retrouvée dans le flux live (chrono/statut à jour) ; le sheet se ferme si elle disparaît.
  const selected = useMemo(
    () => visible.find((o) => o.id === selectedId) ?? null,
    [visible, selectedId]
  );
  return {
    visible,
    cooking,
    scheduled,
    productionPlan,
    toLaunchCount,
    toLaunchUrgent,
    ready,
    toPay,
    readyAlert,
    selected,
  };
}
