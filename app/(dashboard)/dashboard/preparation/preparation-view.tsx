'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Plus, X } from 'lucide-react';
import {
  markOrderPaidFromKitchen,
  setOrderCustomerFromKitchen,
} from './actions';
import { UndoToastProvider } from '@/lib/hooks/use-undo-toast';
import { type PreparationOrder } from '@/lib/preparation-queue';
import type { MenuCategory } from '@/config/menu';
import type { ContactSettings } from '@/lib/contact-settings';
import {
  playNewOrderChime,
  useOrdersStream,
  useSoundPreference,
} from '@/lib/hooks/use-orders-stream';
import { useNowTick } from '@/lib/hooks/use-now-tick';
import { PreparationHeader } from './_components/preparation-header';
import { EmptyState } from './_components/empty-state';
import { PrepOrderCard } from './_components/prep-order-card';
import { OrderDetailSheet } from './_components/order-detail-sheet';
import { OrdersListSheet } from './_components/orders-list-sheet';
import { ProductionSheet } from './_components/production-sheet';
import { normalize } from './_components/view/normalize';
import { useCreatedFlash } from './_components/view/use-created-flash';
import { usePreparationActions } from './_components/view/use-preparation-actions';
import { usePreparationLists } from './_components/view/use-preparation-lists';

const SOUND_STORAGE_KEY = 'eba.preparation.sound-enabled';
const SSE_URL = '/api/preparation/stream';

export function PreparationView(props: {
  initialQueue: PreparationOrder[];
  menu: MenuCategory[];
  contactSettings: Pick<ContactSettings, 'yangoLandmark' | 'phone'>;
}) {
  return (
    <UndoToastProvider>
      <PreparationViewInner {...props} />
    </UndoToastProvider>
  );
}

function PreparationViewInner({
  initialQueue,
  menu,
  contactSettings,
}: {
  initialQueue: PreparationOrder[];
  menu: MenuCategory[];
  contactSettings: Pick<ContactSettings, 'yangoLandmark' | 'phone'>;
}) {
  // Commande agrandie dans le bottom sheet de détail (null = fermé).
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Bottom sheet de liste ouvert, null = aucun.
  const [openSheet, setOpenSheet] = useState<
    'scheduled' | 'ready' | 'topay' | 'production' | null
  >(null);
  const { soundEnabled, soundEnabledRef, toggleSound } =
    useSoundPreference(SOUND_STORAGE_KEY);
  const now = useNowTick(15_000);
  const { createdFlash, setCreatedFlash } = useCreatedFlash();

  const { orders, connState, isStale, lastSync } =
    useOrdersStream<PreparationOrder>({
      endpoint: SSE_URL,
      initialOrders: initialQueue,
      normalize,
      getId: (o) => o.id,
      onNewOrders: (newOrders) => {
        // Carillon pour les NOUVELLES commandes en préparation seulement (les prêtes ne sont pas du travail).
        const hasPreparing = newOrders.some((o) => o.status === 'PREPARING');
        if (hasPreparing && soundEnabledRef.current) playNewOrderChime();
      },
    });

  const actions = usePreparationActions(orders);
  const {
    isPending,
    optimisticHidden,
    pendingIds,
    launchError,
    shortageDialog,
    handleReady,
    handleRetrieved,
    handleStartPreparation,
    handleRequestDriver,
    handleCancel,
  } = actions;
  const {
    cooking,
    scheduled,
    productionPlan,
    toLaunchCount,
    toLaunchUrgent,
    ready,
    toPay,
    readyAlert,
    selected,
  } = usePreparationLists(orders, optimisticHidden, selectedId, now);

  // Grille principale vide : plus aucune commande à cuisiner maintenant.
  const isEmpty = cooking.length === 0;

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col">
      <PreparationHeader
        counts={{
          cooking: cooking.length,
          scheduled: scheduled.length,
          ready: ready.length,
          // Premier jour chargé : « ce qu'il y a à faire là, tout de suite », pas un total de la semaine.
          production: productionPlan[0]?.totalItems ?? 0,
          toPay: toPay.length,
        }}
        readyAlert={readyAlert}
        toLaunchCount={toLaunchCount}
        toLaunchUrgent={toLaunchUrgent}
        connState={connState}
        isStale={isStale}
        lastSync={lastSync}
        soundEnabled={soundEnabled}
        onToggleSound={toggleSound}
        onOpenScheduled={() => setOpenSheet('scheduled')}
        onOpenReady={() => setOpenSheet('ready')}
        onOpenProduction={() => setOpenSheet('production')}
        onOpenToPay={() => setOpenSheet('topay')}
      />

      <div className="mt-3 flex justify-end">
        <Link
          href="/dashboard/preparation/new"
          className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Nouvelle commande
        </Link>
      </div>

      {createdFlash && (
        <div className="mt-3 flex items-center gap-3 rounded-xl border-2 border-primary/30 bg-primary/10 px-4 py-3 text-primary shadow-sm">
          <CheckCircle2 className="h-6 w-6 shrink-0" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm font-bold">
            Commande #{createdFlash.padStart(3, '0')} créée
          </p>
          <button
            type="button"
            onClick={() => setCreatedFlash(null)}
            aria-label="Fermer"
            className="shrink-0 rounded-full p-1 transition-colors hover:bg-primary/15"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {launchError && (
        <p
          role="alert"
          className="mt-3 rounded-lg bg-red-100 px-3 py-2 text-sm font-semibold text-red-900 ring-1 ring-red-300 dark:bg-red-950/40 dark:text-red-100 dark:ring-red-800"
        >
          {launchError}
        </p>
      )}

      {isEmpty ? (
        <div className="flex flex-1 pt-4">
          <EmptyState />
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-5 pt-4">
          {/* À cuisiner maintenant ; toucher une carte l'agrandit dans le bottom sheet de détail. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {cooking.map((order) => (
              <PrepOrderCard
                key={order.id}
                order={order}
                now={now}
                pending={pendingIds.has(order.id) || isPending}
                contactSettings={contactSettings}
                onExpand={setSelectedId}
                onReady={handleReady}
                onCancel={handleCancel}
                onRequestDriver={handleRequestDriver}
                onRetrieve={handleRetrieved}
              />
            ))}
          </div>
        </div>
      )}

      {/* Détail agrandi (lisible de loin), ouvert au toucher d'une carte/ligne. */}
      <OrderDetailSheet
        order={selected}
        menu={menu}
        now={now}
        pending={selected ? pendingIds.has(selected.id) || isPending : false}
        contactSettings={contactSettings}
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
        onRetrieve={(id) => {
          setSelectedId(null);
          handleRetrieved(id);
        }}
        payAction={markOrderPaidFromKitchen}
        customerAction={setOrderCustomerFromKitchen}
      />

      {/* Commandes hors du travail courant, rangées dans des bottom sheets. */}
      <OrdersListSheet
        variant="scheduled"
        orders={scheduled}
        now={now}
        open={openSheet === 'scheduled'}
        onOpenChange={(o) => setOpenSheet(o ? 'scheduled' : null)}
        onExpand={setSelectedId}
        pendingIds={pendingIds}
        onRetrieve={handleRetrieved}
        onStartPreparation={handleStartPreparation}
        onCancel={handleCancel}
      />
      <ProductionSheet
        plan={productionPlan}
        open={openSheet === 'production'}
        onOpenChange={(o) => setOpenSheet(o ? 'production' : null)}
      />
      <OrdersListSheet
        variant="ready"
        orders={ready}
        now={now}
        open={openSheet === 'ready'}
        onOpenChange={(o) => setOpenSheet(o ? 'ready' : null)}
        onExpand={setSelectedId}
        pendingIds={pendingIds}
        onRetrieve={handleRetrieved}
        onCancel={handleCancel}
      />
      <OrdersListSheet
        variant="topay"
        orders={toPay}
        now={now}
        open={openSheet === 'topay'}
        onOpenChange={(o) => setOpenSheet(o ? 'topay' : null)}
        onExpand={setSelectedId}
        pendingIds={pendingIds}
        onRetrieve={handleRetrieved}
        onCancel={handleCancel}
        action={markOrderPaidFromKitchen}
      />
      {shortageDialog}
    </div>
  );
}
