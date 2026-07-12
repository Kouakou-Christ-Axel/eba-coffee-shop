'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';
import {
  cancelOrderFromKitchen,
  markOrderReady,
  requestDriver,
} from './actions';
import { type PreparationOrder } from '@/lib/preparation-queue';
import {
  playNewOrderChime,
  useOrdersStream,
  useSoundPreference,
} from '@/lib/hooks/use-orders-stream';
import { useNowTick } from '@/lib/hooks/use-now-tick';
import { normalizeOrderDates } from '@/lib/orders/format';
import { isScheduledAhead } from '@/lib/orders/scheduling';
import { READY_WAIT_ALERT_MINUTES } from '@/config/constants';
import { PreparationHeader } from './_components/preparation-header';
import { EmptyState } from './_components/empty-state';
import { PrepOrderCard } from './_components/prep-order-card';
import { OrderDetailSheet } from './_components/order-detail-sheet';
import { OrdersListSheet } from './_components/orders-list-sheet';
import { elapsedMinutes } from './_components/elapsed';

const SOUND_STORAGE_KEY = 'eba.preparation.sound-enabled';
const SSE_URL = '/api/preparation/stream';

type RawPreparationOrder = Omit<
  PreparationOrder,
  'pickupTime' | 'createdAt' | 'preparingStartedAt' | 'readyAt'
> & {
  pickupTime: string | null;
  createdAt: string;
  preparingStartedAt: string | null;
  readyAt: string | null;
};

function normalize(raw: unknown): PreparationOrder {
  return normalizeOrderDates(raw as RawPreparationOrder);
}

export function PreparationView({
  initialQueue,
}: {
  initialQueue: PreparationOrder[];
}) {
  const [isPending, startTransition] = useTransition();
  // Commandes masquées optimistiquement (annulation) le temps que le serveur
  // réconcilie via SSE.
  const [optimisticHidden, setOptimisticHidden] = useState<Set<string>>(
    () => new Set()
  );
  // Cartes en cours d'action (spinner + double-clic bloqué), par commande.
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  // Commande agrandie dans le bottom sheet de détail (null = fermé).
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Bottom sheet de liste ouvert (programmées / prêtes), null = aucun.
  const [openSheet, setOpenSheet] = useState<'scheduled' | 'ready' | null>(
    null
  );
  const { soundEnabled, soundEnabledRef, toggleSound } =
    useSoundPreference(SOUND_STORAGE_KEY);
  const now = useNowTick(15_000);

  const { orders, connState, lastSync } = useOrdersStream<PreparationOrder>({
    endpoint: SSE_URL,
    initialOrders: initialQueue,
    normalize,
    getId: (o) => o.id,
    onNewOrders: (newOrders) => {
      // Ne carillonner que pour les NOUVELLES commandes en préparation (pas les
      // prêtes, qui apparaissent aussi dans le flux mais ne sont pas du travail).
      const hasPreparing = newOrders.some((o) => o.status === 'PREPARING');
      if (hasPreparing && soundEnabledRef.current) playNewOrderChime();
    },
  });

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
  // Programmées lointaines (retrait > seuil) : déchargées de la grille.
  const scheduled = useMemo(
    () =>
      visible
        .filter((o) => o.status === 'PREPARING' && isScheduledAhead(o, now))
        .sort(
          (a, b) =>
            (a.pickupTime?.getTime() ?? 0) - (b.pickupTime?.getTime() ?? 0)
        ),
    [visible, now]
  );
  const ready = useMemo(
    () => visible.filter((o) => o.status === 'READY'),
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
  // Commande actuellement agrandie (retrouvée dans le flux live → chrono/statut
  // à jour ; le sheet se ferme tout seul si elle disparaît).
  const selected = useMemo(
    () => visible.find((o) => o.id === selectedId) ?? null,
    [visible, selectedId]
  );

  const setPending = useCallback((id: string, on: boolean) => {
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const handleReady = useCallback(
    (id: string) => {
      setPending(id, true);
      startTransition(async () => {
        try {
          await markOrderReady(id);
        } catch (err) {
          console.error('[preparation] markOrderReady échoué :', err);
        } finally {
          setPending(id, false);
        }
      });
    },
    [setPending]
  );

  const handleRequestDriver = useCallback(
    (id: string) => {
      setPending(id, true);
      startTransition(async () => {
        try {
          await requestDriver(id);
        } catch (err) {
          console.error('[preparation] requestDriver échoué :', err);
        } finally {
          setPending(id, false);
        }
      });
    },
    [setPending]
  );

  const handleCancel = useCallback(
    (id: string) => {
      const order = orders.find((o) => o.id === id);
      if (!confirm(`Annuler la commande ${order?.reference ?? ''} ?`)) return;
      setPending(id, true);
      setOptimisticHidden((prev) => new Set(prev).add(id));
      startTransition(async () => {
        try {
          await cancelOrderFromKitchen(id);
        } catch (err) {
          console.error('[preparation] cancelOrderFromKitchen échoué :', err);
        } finally {
          setPending(id, false);
        }
      });
    },
    [orders, setPending]
  );

  // Grille principale vide : plus aucune commande à cuisiner maintenant.
  const isEmpty = cooking.length === 0;

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col">
      <PreparationHeader
        counts={{
          cooking: cooking.length,
          scheduled: scheduled.length,
          ready: ready.length,
        }}
        readyAlert={readyAlert}
        connState={connState}
        lastSync={lastSync}
        soundEnabled={soundEnabled}
        onToggleSound={toggleSound}
        onOpenScheduled={() => setOpenSheet('scheduled')}
        onOpenReady={() => setOpenSheet('ready')}
      />

      {isEmpty ? (
        <div className="flex flex-1 pt-4">
          <EmptyState />
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-5 pt-4">
          {/* À cuisiner maintenant : grille de cartes, visible d'un coup d'œil.
              Toucher une carte l'agrandit dans le bottom sheet de détail. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {cooking.map((order) => (
              <PrepOrderCard
                key={order.id}
                order={order}
                now={now}
                pending={pendingIds.has(order.id) || isPending}
                onExpand={setSelectedId}
                onReady={handleReady}
                onCancel={handleCancel}
                onRequestDriver={handleRequestDriver}
              />
            ))}
          </div>
        </div>
      )}

      {/* Détail agrandi (lisible de loin), ouvert au toucher d'une carte/ligne. */}
      <OrderDetailSheet
        order={selected}
        now={now}
        pending={selected ? pendingIds.has(selected.id) || isPending : false}
        onClose={() => setSelectedId(null)}
        onReady={(id) => {
          setSelectedId(null);
          handleReady(id);
        }}
        onCancel={(id) => {
          setSelectedId(null);
          handleCancel(id);
        }}
        onRequestDriver={handleRequestDriver}
      />

      {/* Commandes hors du travail courant, rangées dans des bottom sheets. */}
      <OrdersListSheet
        variant="scheduled"
        orders={scheduled}
        now={now}
        open={openSheet === 'scheduled'}
        onOpenChange={(o) => setOpenSheet(o ? 'scheduled' : null)}
        onExpand={setSelectedId}
      />
      <OrdersListSheet
        variant="ready"
        orders={ready}
        now={now}
        open={openSheet === 'ready'}
        onOpenChange={(o) => setOpenSheet(o ? 'ready' : null)}
        onExpand={setSelectedId}
      />
    </div>
  );
}
