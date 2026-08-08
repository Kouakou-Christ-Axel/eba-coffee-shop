'use client';

// components/(public)/commande/order-notifications-modal.tsx
//
// Popup d'incitation aux notifications, sur la page de suivi (code de
// retrait) : pousse la demande sur le devant de la scène au lieu de compter
// sur le bloc inline (order-notifications.tsx) pour se faire remarquer.
//
// Ne s'affiche QUE quand la permission navigateur n'a encore jamais été
// tranchée (Notification.permission === 'default') : si elle est déjà
// accordée, useOrderPushNotifications rebascule l'appareil en silence sur
// cette commande (cf. ce hook) — pas besoin de repopup à chaque commande. Si
// elle est refusée, la popup n'a rien à proposer. Une seule apparition par
// commande : un rejet est mémorisé et n'est pas reproposé au rechargement.

import { useEffect, useState } from 'react';
import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@heroui/react';
import { BellRing } from 'lucide-react';
import { useOrderPushNotifications } from '@/lib/hooks/use-order-push-notifications';

/** Commande pour laquelle la popup a déjà été proposée (acceptée ou non). */
const PROMPTED_KEY = 'eba-push-prompt-order';
const SHOW_DELAY_MS = 1200;

export function OrderNotificationsModal({
  orderId,
  isFinal,
  pickupCode,
}: {
  orderId: string;
  isFinal: boolean;
  pickupCode: string;
}) {
  const { status, pending, enable } = useOrderPushNotifications({
    orderId,
    isFinal,
  });
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== 'off') return;
    if (
      typeof Notification === 'undefined' ||
      Notification.permission !== 'default'
    ) {
      return;
    }
    if (localStorage.getItem(PROMPTED_KEY) === orderId) return;

    const timer = setTimeout(() => setOpen(true), SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [status, orderId]);

  function dismiss() {
    localStorage.setItem(PROMPTED_KEY, orderId);
    setError(null);
    setOpen(false);
  }

  async function activate() {
    setError(null);
    const ok = await enable();
    localStorage.setItem(PROMPTED_KEY, orderId);
    if (ok) {
      setOpen(false);
      return;
    }
    // Échec (refus, souci réseau, souscription qui échoue — fréquent sur
    // mobile) : on garde la popup ouverte avec un message explicite plutôt
    // que de la fermer silencieusement (l'utilisateur cliquait sans jamais
    // savoir pourquoi ça n'avait pas marché) ou de la laisser bloquée sans
    // aucun retour. Le bouton reste disponible pour réessayer (utile en cas
    // de souci réseau ponctuel).
    setError(
      Notification.permission === 'denied'
        ? 'Notifications bloquées dans les réglages de ton navigateur — active-les manuellement pour être prévenu(e).'
        : "Impossible d'activer les notifications pour l'instant. Réessaie dans un instant."
    );
  }

  return (
    <Modal
      isOpen={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) dismiss();
      }}
      placement="center"
      backdrop="blur"
      size="sm"
    >
      <ModalContent>
        <ModalHeader className="flex flex-col items-center gap-3 pt-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <BellRing className="h-6 w-6" />
          </span>
          Ne rate pas ta commande
        </ModalHeader>
        <ModalBody className="text-center">
          <p className="text-sm text-foreground/70">
            Active les notifications pour être prévenu dès que ta commande{' '}
            <span className="font-mono font-semibold text-primary">
              {pickupCode}
            </span>{' '}
            est prête — plus besoin de garder cette page ouverte.
          </p>
          {error && <p className="text-sm text-danger">{error}</p>}
        </ModalBody>
        <ModalFooter className="flex-col gap-2 pb-6">
          <Button
            color="primary"
            className="w-full"
            isLoading={pending}
            onPress={activate}
            startContent={!pending && <BellRing className="h-4 w-4" />}
          >
            Activer les notifications
          </Button>
          <Button
            variant="light"
            className="w-full"
            isDisabled={pending}
            onPress={dismiss}
          >
            Plus tard
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
