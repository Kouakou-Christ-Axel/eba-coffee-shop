'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  cancelOrderFromKitchen,
  markOrderReady,
  requestDriver,
} from './actions';
import { type PreparationOrder } from '@/lib/preparation-queue';
import { PreparationQueueList } from './preparation-queue-list';
import {
  playNewOrderChime,
  useOrdersStream,
  useSoundPreference,
} from '@/lib/hooks/use-orders-stream';
import { normalizeOrderDates } from '@/lib/orders/format';
import { PreparationHeader } from './_components/preparation-header';
import { EmptyState } from './_components/empty-state';
import { OrderDetail } from './_components/order-detail';

const SOUND_STORAGE_KEY = 'eba.preparation.sound-enabled';
const SSE_URL = '/api/preparation/stream';

type RawPreparationOrder = Omit<
  PreparationOrder,
  'pickupTime' | 'createdAt'
> & {
  pickupTime: string | null;
  createdAt: string;
};

function normalize(raw: unknown): PreparationOrder {
  return normalizeOrderDates(raw as RawPreparationOrder);
}

export function PreparationView({
  initialQueue,
}: {
  initialQueue: PreparationOrder[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    initialQueue[0]?.id ?? null
  );
  const [isPending, startTransition] = useTransition();
  const [optimisticHidden, setOptimisticHidden] = useState<Set<string>>(
    () => new Set()
  );
  const { soundEnabled, soundEnabledRef, toggleSound } =
    useSoundPreference(SOUND_STORAGE_KEY);

  const { orders, connState, lastSync } = useOrdersStream<PreparationOrder>({
    endpoint: SSE_URL,
    initialOrders: initialQueue,
    normalize,
    getId: (o) => o.id,
    onNewOrders: (newOrders) => {
      if (newOrders.length > 0 && soundEnabledRef.current) {
        playNewOrderChime();
      }
    },
  });

  // Filtrer les commandes marquées optimistiquement, et nettoyer celles
  // qui ne sont plus dans le snapshot (le serveur a réconcilié).
  const queue = useMemo(() => {
    return orders.filter((o) => !optimisticHidden.has(o.id));
  }, [orders, optimisticHidden]);

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

  function hideAndAdvance(id: string) {
    const nextId = pickNextSelection(currentIndex, queue);
    setOptimisticHidden((prev) => new Set(prev).add(id));
    setSelectedId(nextId);
  }

  function handleReady() {
    if (!current || isPending) return;
    const id = current.id;
    hideAndAdvance(id);
    startTransition(async () => {
      try {
        await markOrderReady(id);
      } catch (err) {
        console.error('[preparation] markOrderReady échoué :', err);
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
    hideAndAdvance(id);
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
      <PreparationHeader
        position={current ? { index: currentIndex, total: queue.length } : null}
        connState={connState}
        lastSync={lastSync}
        soundEnabled={soundEnabled}
        onToggleSound={toggleSound}
      />

      <div className="grid flex-1 grid-cols-1 gap-4 pt-4 lg:grid-cols-[1fr_360px] lg:gap-6">
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

        <aside className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-6rem)] lg:self-start">
          <PreparationQueueList
            orders={queue}
            selectedId={current?.id ?? null}
            onSelect={setSelectedId}
          />
        </aside>
      </div>
    </div>
  );
}
