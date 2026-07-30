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
import { cn } from '@/lib/utils';
import type { CashierOrder } from '@/lib/cashier-queue';
import { OrderTypePicker } from './new/_components/order-type-picker';

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
  const [isPending, startTransition] = useTransition();

  function resetState() {
    setOrderType(order.orderType);
    setPickupTime(order.pickupTime ? order.pickupTime.toISOString() : null);
    setDriverName(order.driverName ?? '');
    setDriverPhone(order.driverPhone ?? '');
    setError(null);
  }

  function handleClose() {
    if (isPending) return;
    resetState();
    onClose();
  }

  function applyPreset(minutes: number) {
    setPickupTime(presetPickupTime(minutes));
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
              {PICKUP_QUICK_PRESETS_MINUTES.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  onClick={() => applyPreset(minutes)}
                  className={cn(
                    'rounded-full border-2 px-3 py-1.5 text-xs font-medium transition-colors',
                    'border-border bg-card hover:bg-muted'
                  )}
                >
                  {minutes < 60
                    ? `Dans ${minutes} min`
                    : `Dans ${minutes / 60}h`}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPickupTime(null)}
                className={cn(
                  'rounded-full border-2 px-3 py-1.5 text-xs font-medium transition-colors',
                  pickupTime === null
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card hover:bg-muted'
                )}
              >
                Pas de créneau
              </button>
            </div>
            <Input
              type="datetime-local"
              label="Ou date/heure précise"
              className="mt-2"
              value={isoToAbidjanDatetimeLocal(pickupTime)}
              onValueChange={(v) => setPickupTime(abidjanDatetimeLocalToISO(v))}
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
