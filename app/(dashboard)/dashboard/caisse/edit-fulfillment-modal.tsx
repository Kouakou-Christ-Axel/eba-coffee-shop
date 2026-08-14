'use client';

// Modale d'édition de la « prise en charge » d'une commande depuis la caisse
// (CASHIER_PLUS) : type de commande, créneau de retrait / heure d'arrivée du
// livreur, identité du livreur. Distincte de la modale ADMIN
// (`/dashboard/commandes/[id]/edit-order-details.tsx`) : ne touche jamais le
// moyen de paiement. Branche `PATCH /api/caisse/orders/:id/fulfillment`.

import { useState, useTransition } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
} from '@heroui/react';
import { CalendarClock } from 'lucide-react';
import { PICKUP_QUICK_PRESETS_MINUTES } from '@/config/constants';
import {
  abidjanDatetimeLocalToISO,
  isoToAbidjanDatetimeLocal,
} from '@/lib/timezone';
import { isPickupAt, pickupISOAt } from '@/lib/orders/scheduling';
import type { CashierOrder } from '@/lib/cashier-queue';
import { OrderTypePicker } from './new/_components/order-type-picker';
import { TimeChip } from '../_components/time-chip';
import { useNextOpenPickup } from '../_components/use-next-open-pickup';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  order: CashierOrder;
};

/** ISO 8601 pour « dans N minutes » à partir de maintenant. */
function presetPickupTime(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

export function EditFulfillmentModal({ isOpen, onClose, order }: Props) {
  const [orderType, setOrderType] = useState(order.orderType);
  const [pickupTime, setPickupTime] = useState<string | null>(
    order.pickupTime ? order.pickupTime.toISOString() : null
  );
  const [driverName, setDriverName] = useState(order.driverName ?? '');
  const [driverPhone, setDriverPhone] = useState(order.driverPhone ?? '');
  const [error, setError] = useState<string | null>(null);
  // Préset de créneau choisi, pour l'afficher comme actif. On ne peut PAS le
  // déduire de `pickupTime` : `presetPickupTime` part de l'heure courante, donc
  // la valeur stockée ne correspond plus au préset dès la minute suivante.
  const [activePreset, setActivePreset] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  function resetState() {
    setOrderType(order.orderType);
    setPickupTime(order.pickupTime ? order.pickupTime.toISOString() : null);
    setDriverName(order.driverName ?? '');
    setDriverPhone(order.driverPhone ?? '');
    setError(null);
    setActivePreset(null);
  }

  function handleClose() {
    if (isPending) return;
    resetState();
    onClose();
  }

  function applyPreset(minutes: number) {
    setPickupTime(presetPickupTime(minutes));
    setActivePreset(minutes);
  }

  // Raccourci « jour ouvert suivant » (typiquement « Demain 11h ») : ne charge
  // les horaires qu'à l'ouverture de la modale (`enabled: isOpen`).
  const nextOpenPickup = useNextOpenPickup(isOpen);

  function applyNextOpenPickup() {
    if (!nextOpenPickup) return;
    setPickupTime(
      pickupISOAt(nextOpenPickup.target.date, nextOpenPickup.target.time)
    );
    setActivePreset(null);
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/caisse/orders/${order.id}/fulfillment`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderType,
            pickupTime,
            driverName: driverName.trim() ? driverName.trim() : null,
            driverPhone: driverPhone.trim() ? driverPhone.trim() : null,
          }),
        });
        if (!res.ok) {
          let msg = `Erreur ${res.status}`;
          try {
            const data = (await res.json()) as { error?: string };
            if (typeof data.error === 'string') msg = data.error;
          } catch {
            // ignore
          }
          setError(msg);
          return;
        }
        onClose();
      } catch {
        setError('Erreur réseau');
      }
    });
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      placement="center"
      size="lg"
      scrollBehavior="inside"
      isDismissable={!isPending}
      hideCloseButton={isPending}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <span className="text-base font-semibold">
            Modifier la prise en charge
          </span>
          <span className="text-sm font-normal text-default-500">
            Commande #{String(order.dailyNumber).padStart(3, '0')}
          </span>
        </ModalHeader>

        <ModalBody className="gap-4">
          {error && (
            <p className="rounded-medium bg-danger-50 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          <OrderTypePicker value={orderType} onChange={setOrderType} />

          <div className="rounded-xl border bg-card p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
              Créneau de retrait / arrivée du livreur
            </p>
            <div className="flex flex-wrap gap-2">
              {/*
                Deux régimes d'état actif cohabitent ici :
                - les présets minute (« Dans 2h ») restent un état STOCKÉ
                  (`activePreset`) : `presetPickupTime` part de `Date.now()`,
                  donc la valeur soumise ne correspond plus au préset dès la
                  minute suivante — rien à dériver ;
                - le raccourci « jour ouvert suivant » vise un instant ABSOLU
                  (tel jour, telle heure) : son état est DÉRIVÉ de `pickupTime`
                  via `isPickupAt`, donc encore allumé si on rouvre la modale
                  sans rien changer — contrairement aux présets minute.
              */}
              {PICKUP_QUICK_PRESETS_MINUTES.map((minutes) => (
                <TimeChip
                  key={minutes}
                  size="md"
                  isActive={activePreset === minutes}
                  onPress={() => applyPreset(minutes)}
                >
                  {minutes < 60
                    ? `Dans ${minutes} min`
                    : `Dans ${minutes / 60}h`}
                </TimeChip>
              ))}
              {nextOpenPickup && (
                <TimeChip
                  size="md"
                  isActive={isPickupAt(
                    pickupTime,
                    nextOpenPickup.target.date,
                    nextOpenPickup.target.time
                  )}
                  onPress={applyNextOpenPickup}
                >
                  {nextOpenPickup.label}
                </TimeChip>
              )}
              <TimeChip
                size="md"
                isActive={pickupTime === null}
                onPress={() => {
                  setPickupTime(null);
                  setActivePreset(null);
                }}
              >
                Pas de créneau
              </TimeChip>
            </div>
            <Input
              type="datetime-local"
              label="Ou date/heure précise"
              className="mt-2"
              value={isoToAbidjanDatetimeLocal(pickupTime)}
              onValueChange={(v) => {
                setPickupTime(abidjanDatetimeLocalToISO(v));
                setActivePreset(null);
              }}
            />
          </div>

          <div className="rounded-xl border bg-card p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Livreur (envoyé par le client)
            </p>
            <div className="grid gap-2">
              <Input
                label="Nom du livreur"
                value={driverName}
                onValueChange={setDriverName}
                placeholder="Ex. Ibrahim"
              />
              <Input
                type="tel"
                label="Téléphone du livreur (optionnel)"
                value={driverPhone}
                onValueChange={setDriverPhone}
                placeholder="07 88 12 34 56"
              />
            </div>
          </div>
        </ModalBody>

        <ModalFooter>
          <Button
            type="button"
            variant="flat"
            isDisabled={isPending}
            onPress={handleClose}
          >
            Annuler
          </Button>
          <Button
            type="button"
            color="primary"
            isLoading={isPending}
            onPress={handleSubmit}
          >
            Enregistrer
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
