'use client';

// components/(public)/commande/order-self-service.tsx
//
// Libre-service sur la page de suivi : le client agit SEUL tant que rien n'est
// engagé (ni payé, ni en cuisine — `order.selfService`, calculé côté serveur) :
//   - remplacer/retirer un article devenu indisponible (même panneau que le
//     checkout, `SoldOutResolver` en mode `order`) ;
//   - changer de créneau (même sélecteur que le checkout) ;
//   - annuler, après confirmation.
// Chaque geste part tout de suite au serveur, qui revérifie l'éligibilité et
// renvoie la commande à jour (lib/order-self-service-client.ts).
//
// Chargé via `next/dynamic` par order-tracking.tsx, et seulement quand une
// action est possible : une commande payée ou en cuisine n'embarque rien de
// ce code.

import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@heroui/react';
import { CalendarClock, XCircle } from 'lucide-react';
import type { PublicOrderView } from '@/lib/orders';
import type { SoldOutLine } from '@/lib/schemas/order';
import type { PickupTiming } from '@/lib/hooks/use-checkout-form';
import { usePickupInfo } from '@/lib/hooks/use-pickup-info';
import { effectiveItemAdvanceDays } from '@/lib/supplements';
import {
  cancelOrder,
  changeOrderItems,
  rescheduleOrder,
  type SelfServiceOutcome,
} from '@/lib/order-self-service-client';
import { SlotPicker } from '@/components/(public)/carte/_components/slot-picker';

const SoldOutResolver = dynamic(
  () => import('@/components/(public)/carte/_components/sold-out-resolver'),
  { ssr: false }
);

type Props = {
  order: PublicOrderView;
  onOrderChange: (order: PublicOrderView) => void;
  /** Panneau « Remplacer » ouvert depuis le bandeau d'alerte stock. */
  resolveOpen: boolean;
  onResolveOpenChange: (open: boolean) => void;
};

export default function OrderSelfService({
  order,
  onOrderChange,
  resolveOpen,
  onResolveOpenChange,
}: Props) {
  const { canCancel, canReschedule, canEditItems } = order.selfService;
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  // Ouvert depuis « Tout garder, retrait à partir de demain » : le sélecteur
  // impose alors J+1 (article épuisé aujourd'hui).
  const [forceTomorrow, setForceTomorrow] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  // Lignes indisponibles, au format du panneau « Résoudre ». Le stock
  // restant n'est pas exposé publiquement : l'option « garder N » n'existe
  // pas ici (le serveur ne sait que remplacer ou retirer).
  const soldOutLines = useMemo<SoldOutLine[]>(
    () =>
      order.items
        .filter((i) => !i.available)
        .map((i) => ({
          cartId: i.cartId,
          productId: i.productId,
          productName: i.productName,
          missingProduct: i.missingProduct ?? true,
          missingOptionNames: i.missingOptionNames ?? [],
          remaining: null,
        })),
    [order.items]
  );

  /** Exécute un geste, affiche la commande à jour ou rend l'erreur. */
  async function run(
    action: () => Promise<SelfServiceOutcome>
  ): Promise<string | null> {
    setBusy(true);
    try {
      const outcome = await action();
      if (outcome.ok) {
        onOrderChange(outcome.order);
        return null;
      }
      return outcome.error;
    } finally {
      setBusy(false);
    }
  }

  async function handleReplaceOrRemove(
    change: Parameters<typeof changeOrderItems>[1][number]
  ) {
    setResolveError(await run(() => changeOrderItems(order.id, [change])));
  }

  if (!canCancel && !canReschedule && !canEditItems && !resolveOpen) {
    return null;
  }

  return (
    <>
      {(canReschedule || canCancel) && (
        <div className="rounded-xl border border-foreground/10 p-4">
          <p className="text-sm font-semibold">Un changement de programme ?</p>
          <p className="mt-0.5 text-xs text-foreground/55">
            Possible tant que ta commande n’est ni payée ni en préparation.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {canReschedule && (
              <Button
                variant="bordered"
                size="sm"
                className="min-h-9"
                startContent={
                  <CalendarClock className="h-4 w-4" aria-hidden="true" />
                }
                onPress={() => {
                  setForceTomorrow(false);
                  setRescheduleOpen(true);
                }}
              >
                Changer le créneau
              </Button>
            )}
            {canCancel && (
              <Button
                variant="light"
                color="danger"
                size="sm"
                className="min-h-9"
                startContent={
                  <XCircle className="h-4 w-4" aria-hidden="true" />
                }
                onPress={() => setCancelOpen(true)}
              >
                Annuler la commande
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Reste monté une fois ouvert, même quand la commande redevient
          servable : le client voit « C'est réglé » au lieu d'un panneau qui
          disparaît sous son doigt. */}
      {resolveOpen && (
        <SoldOutResolver
          mode="order"
          isOpen
          onClose={() => {
            setResolveError(null);
            onResolveOpenChange(false);
          }}
          lines={soldOutLines}
          items={order.items}
          busy={busy}
          error={resolveError}
          onReplace={(cartId, draft, quantity) =>
            handleReplaceOrRemove({
              cartId,
              action: 'replace',
              with: {
                productId: draft.productId,
                quantity,
                supplements: draft.supplements.map((s) => ({
                  groupName: s.groupName,
                  optionName: s.optionName,
                  quantity: s.quantity,
                })),
              },
            })
          }
          onRemove={(cartId) =>
            handleReplaceOrRemove({ cartId, action: 'remove' })
          }
          onDeferAll={() => {
            setResolveError(null);
            onResolveOpenChange(false);
            setForceTomorrow(true);
            setRescheduleOpen(true);
          }}
        />
      )}

      {rescheduleOpen && (
        <RescheduleModal
          order={order}
          forceTomorrow={forceTomorrow}
          busy={busy}
          onClose={() => setRescheduleOpen(false)}
          onSave={async (pickupTime) => {
            const error = await run(() =>
              rescheduleOrder(order.id, pickupTime)
            );
            if (!error) setRescheduleOpen(false);
            return error;
          }}
        />
      )}

      <CancelModal
        isOpen={cancelOpen}
        busy={busy}
        onClose={() => setCancelOpen(false)}
        onConfirm={async () => {
          const error = await run(() => cancelOrder(order.id));
          if (!error) setCancelOpen(false);
          return error;
        }}
      />
    </>
  );
}

// ─── Changement de créneau ───────────────────────────────────────────────────

function RescheduleModal({
  order,
  forceTomorrow,
  busy,
  onClose,
  onSave,
}: {
  order: PublicOrderView;
  forceTomorrow: boolean;
  busy: boolean;
  onClose: () => void;
  onSave: (pickupTime: string | null) => Promise<string | null>;
}) {
  const [timing, setTiming] = useState<PickupTiming>(
    order.pickupTime || forceTomorrow ? 'scheduled' : 'asap'
  );
  const [value, setValue] = useState<string | null>(
    forceTomorrow ? null : order.pickupTime
  );
  const [error, setError] = useState<string | undefined>();

  // Mêmes contraintes de jour qu'au checkout : délai à l'avance des articles,
  // plus J+1 quand le client garde un article épuisé aujourd'hui.
  const minAdvanceOrderDays = Math.max(
    forceTomorrow ? 1 : 0,
    ...order.items.map((i) => effectiveItemAdvanceDays(i))
  );
  const soldOutRestricted =
    forceTomorrow || order.items.some((i) => i.soldOutToday === true);
  const info = usePickupInfo(minAdvanceOrderDays);

  async function save() {
    if (timing === 'scheduled' && !value) {
      setError('Choisis un créneau.');
      return;
    }
    setError(
      (await onSave(timing === 'scheduled' ? value : null)) ?? undefined
    );
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      placement="auto"
      size="lg"
      scrollBehavior="inside"
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          Changer le créneau
          <span className="text-sm font-normal text-foreground/60">
            {forceTomorrow
              ? 'Ton article sera préparé pour le jour que tu choisis.'
              : 'Choisis quand tu passes récupérer ta commande.'}
          </span>
        </ModalHeader>
        <ModalBody>
          <SlotPicker
            timing={timing}
            onTimingChange={(t) => {
              setTiming(t);
              setError(undefined);
            }}
            value={value}
            onChange={(iso) => {
              setValue(iso);
              setError(undefined);
            }}
            error={error}
            info={info}
            items={order.items}
            minAdvanceOrderDays={minAdvanceOrderDays}
            soldOutRestricted={soldOutRestricted}
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose} isDisabled={busy}>
            Retour
          </Button>
          <Button color="primary" onPress={save} isLoading={busy}>
            Enregistrer
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

// ─── Annulation ──────────────────────────────────────────────────────────────

function CancelModal({
  isOpen,
  busy,
  onClose,
  onConfirm,
}: {
  isOpen: boolean;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => Promise<string | null>;
}) {
  const [error, setError] = useState<string | null>(null);

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        setError(null);
        onClose();
      }}
      placement="auto"
    >
      <ModalContent>
        <ModalHeader>Annuler ta commande ?</ModalHeader>
        <ModalBody>
          <p className="text-sm text-foreground/70">
            C’est définitif. Le tampon fidélité gagné avec cette commande sera
            retiré, et une récompense utilisée te sera rendue.
          </p>
          {error && (
            <p
              role="alert"
              className="rounded-xl bg-danger-50 px-3 py-2.5 text-sm text-danger-700"
            >
              {error}
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose} isDisabled={busy}>
            Garder ma commande
          </Button>
          <Button
            color="danger"
            isLoading={busy}
            onPress={async () => setError(await onConfirm())}
          >
            Oui, annuler
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
