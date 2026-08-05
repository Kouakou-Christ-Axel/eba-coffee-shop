'use client';

// components/(public)/commande/order-notifications.tsx
//
// Bloc « Sois prévenu en direct » de la page publique de suivi : le client
// active les notifications push pour SA commande (préparation, prête,
// récupérée, paiement validé) — plus besoin de garder la page ouverte.
//
// Complété par la popup order-notifications-modal.tsx (incitation au premier
// affichage) ; les deux partagent l'état via useOrderPushNotifications.
// Masqué si non supporté (dont Safari iOS hors PWA installée) ou commande
// terminée.

import { Button, Chip } from '@heroui/react';
import { Bell, BellRing } from 'lucide-react';
import { useOrderPushNotifications } from '@/lib/hooks/use-order-push-notifications';

export function OrderNotifications({
  orderId,
  isFinal,
}: {
  orderId: string;
  isFinal: boolean;
}) {
  const { status, pending, enable, disable } = useOrderPushNotifications({
    orderId,
    isFinal,
  });

  if (status === 'hidden') return null;

  return (
    <div className="rounded-xl border border-foreground/10 bg-default-50 p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground/40">
          {status === 'on' ? (
            <BellRing className="h-4 w-4 text-primary" />
          ) : (
            <Bell className="h-4 w-4" />
          )}
          Notifications
        </p>
        {status === 'on' && (
          <Chip color="success" variant="flat" size="sm">
            Activées
          </Chip>
        )}
      </div>

      {status === 'denied' ? (
        <p className="mt-3 text-xs text-foreground/60">
          Les notifications sont bloquées dans ton navigateur. Autorise-les dans
          les réglages du site pour être prévenu quand ta commande est prête.
        </p>
      ) : status === 'on' ? (
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-sm text-foreground/70">
            On te prévient dès que ta commande avance — tu peux fermer cette
            page.
          </p>
          <Button
            variant="light"
            size="sm"
            isDisabled={pending}
            onPress={disable}
          >
            Désactiver
          </Button>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          <p className="text-sm text-foreground/70">
            Reçois une notification quand ta commande avance — surtout quand
            c&apos;est <span className="font-semibold">prêt</span>. Plus besoin
            de garder la page ouverte.
          </p>
          <Button
            color="primary"
            variant="flat"
            size="lg"
            className="w-full"
            isLoading={pending}
            onPress={enable}
            startContent={!pending && <Bell className="h-4 w-4" />}
          >
            Activer les notifications
          </Button>
        </div>
      )}
    </div>
  );
}
