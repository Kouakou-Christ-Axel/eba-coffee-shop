'use client';

// Modale d'édition « administrative » des métadonnées d'une commande, RÉSERVÉE
// À L'ADMIN (la page ne rend ce composant que si le rôle est ADMIN, et la server
// action `updateOrderDetailsAction` re-vérifie via `requireAdmin`).
//
// Champs éditables : moyen de paiement, type de commande, créneau de retrait
// (date + heure), note. Branche `updateOrderDetailsAction` (qui revalide la page).

import { useState, useTransition } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Textarea,
  Select,
  SelectItem,
} from '@heroui/react';
import { Pencil } from 'lucide-react';
import type { OrderType, PaymentMode } from '@/generated/prisma/client';
import {
  abidjanDatetimeLocalToISO,
  isoToAbidjanDatetimeLocal,
} from '@/lib/timezone';
import { updateOrderDetailsAction } from '../actions';

const ORDER_TYPE_OPTIONS: { key: OrderType; label: string }[] = [
  { key: 'TAKEAWAY', label: 'À emporter' },
  { key: 'DINE_IN', label: 'Sur place' },
  { key: 'DELIVERY', label: 'Livraison' },
];

const PAYMENT_MODE_OPTIONS: { key: PaymentMode; label: string }[] = [
  { key: 'CASH', label: 'Espèces' },
  { key: 'WAVE', label: 'Wave' },
  { key: 'OTHER', label: 'Autre' },
];

// Valeur « aucun mode » dans le Select (commande non payée uniquement).
const NO_PAYMENT_KEY = 'NONE';

type Props = {
  orderId: string;
  initialOrderType: OrderType;
  /** ISO 8601 (UTC) du créneau de retrait, ou null. */
  initialPickupTime: string | null;
  initialPaymentMode: PaymentMode | null;
  initialNote: string | null;
  isPaid: boolean;
};

export function EditOrderDetails({
  orderId,
  initialOrderType,
  initialPickupTime,
  initialPaymentMode,
  initialNote,
  isPaid,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [orderType, setOrderType] = useState<OrderType>(initialOrderType);
  const [pickup, setPickup] = useState(
    isoToAbidjanDatetimeLocal(initialPickupTime)
  );
  const [paymentMode, setPaymentMode] = useState<string>(
    initialPaymentMode ?? NO_PAYMENT_KEY
  );
  const [note, setNote] = useState(initialNote ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function resetState() {
    setOrderType(initialOrderType);
    setPickup(isoToAbidjanDatetimeLocal(initialPickupTime));
    setPaymentMode(initialPaymentMode ?? NO_PAYMENT_KEY);
    setNote(initialNote ?? '');
    setError(null);
  }

  function handleClose() {
    if (isPending) return;
    setIsOpen(false);
    resetState();
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      try {
        await updateOrderDetailsAction(orderId, {
          orderType,
          pickupTime: abidjanDatetimeLocalToISO(pickup),
          paymentMode:
            paymentMode === NO_PAYMENT_KEY
              ? null
              : (paymentMode as PaymentMode),
          note: note.trim() ? note.trim() : null,
        });
        setIsOpen(false);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur serveur');
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="flat"
        startContent={<Pencil className="h-4 w-4" />}
        onPress={() => setIsOpen(true)}
      >
        Modifier
      </Button>

      <Modal isOpen={isOpen} onClose={handleClose} size="lg">
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            Modifier la commande
            <span className="text-sm font-normal text-default-500">
              Réservé à l’administrateur
            </span>
          </ModalHeader>

          <ModalBody className="gap-4">
            {error && (
              <p className="rounded-medium bg-danger-50 px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}

            <Select
              label="Type de commande"
              selectedKeys={[orderType]}
              disallowEmptySelection
              onSelectionChange={(keys) => {
                if (keys === 'all') return;
                const next = Array.from(keys)[0];
                if (next) setOrderType(next as OrderType);
              }}
            >
              {ORDER_TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.key}>{o.label}</SelectItem>
              ))}
            </Select>

            <Input
              type="datetime-local"
              label="Créneau de retrait"
              description="Laisser vide pour une commande walk-in (sans créneau)."
              value={pickup}
              onValueChange={setPickup}
            />

            <Select
              label="Moyen de paiement"
              selectedKeys={[paymentMode]}
              disallowEmptySelection
              onSelectionChange={(keys) => {
                if (keys === 'all') return;
                const next = Array.from(keys)[0];
                if (next) setPaymentMode(String(next));
              }}
            >
              {[
                // « Aucun » seulement si la commande n'est pas payée : on ne peut
                // pas retirer le mode d'une commande payée (refusé côté serveur).
                ...(isPaid
                  ? []
                  : [{ key: NO_PAYMENT_KEY, label: 'Aucun (non payée)' }]),
                ...PAYMENT_MODE_OPTIONS,
              ].map((o) => (
                <SelectItem key={o.key}>{o.label}</SelectItem>
              ))}
            </Select>

            <Textarea
              label="Note"
              placeholder="Note interne sur la commande…"
              value={note}
              onValueChange={setNote}
              maxRows={4}
            />
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
    </>
  );
}
