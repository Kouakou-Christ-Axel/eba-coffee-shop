'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';
import { PackageCheck } from 'lucide-react';
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
import { PreparationHeader } from './_components/preparation-header';
import { EmptyState } from './_components/empty-state';
import { PrepOrderCard } from './_components/prep-order-card';
import { ReadyOrderCard } from './_components/ready-order-card';
import { PackingModal } from './_components/packing-modal';

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
  const preparing = useMemo(
    () => visible.filter((o) => o.status === 'PREPARING'),
    [visible]
  );
  const ready = useMemo(
    () => visible.filter((o) => o.status === 'READY'),
    [visible]
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

  const isEmpty = preparing.length === 0 && ready.length === 0;

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col">
      <PreparationHeader
        counts={{ preparing: preparing.length, ready: ready.length }}
        connState={connState}
        lastSync={lastSync}
        soundEnabled={soundEnabled}
        onToggleSound={toggleSound}
      />

      {isEmpty ? (
        <div className="flex flex-1 pt-4">
          <EmptyState />
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-5 pt-4">
          {/* File en préparation : grille de cartes, visible d'un coup d'œil. */}
          {preparing.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {preparing.map((order) => (
                <PrepOrderCard
                  key={order.id}
                  order={order}
                  now={now}
                  pending={pendingIds.has(order.id) || isPending}
                  onReady={handleReady}
                  onCancel={handleCancel}
                  onRequestDriver={handleRequestDriver}
                />
              ))}
            </div>
          )}

          {/* En attente de récupération (prêtes) */}
          {ready.length > 0 && (
            <section>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-green-700 dark:text-green-400">
                <PackageCheck className="h-4 w-4" />
                En attente de récupération ({ready.length})
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {ready.map((order) => (
                  <ReadyOrderCard key={order.id} order={order} now={now} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <PackingModal orders={visible} now={now} />
    </div>
  );
}
