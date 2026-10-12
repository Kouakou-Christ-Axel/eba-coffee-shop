import { CalendarClock, XCircle } from 'lucide-react';
import type { deferredPickupLabel } from '@/lib/orders/scheduling';

export function CancelledBanner({
  paymentExpired,
}: {
  paymentExpired: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-danger/30 bg-danger/10 p-4">
      <XCircle className="h-8 w-8 shrink-0 text-danger" />
      <div>
        <p className="font-semibold text-danger">
          {paymentExpired
            ? 'Paiement expiré — commande annulée'
            : 'Commande annulée'}
        </p>
        <p className="text-sm text-foreground/60">
          {paymentExpired
            ? 'Le délai de paiement est dépassé : rien n’a été débité. Tu peux repasser commande depuis la carte.'
            : 'Contacte le comptoir si tu penses qu’il s’agit d’une erreur.'}
        </p>
      </div>
    </div>
  );
}

export function DeferredBanner({
  deferred,
}: {
  deferred: NonNullable<ReturnType<typeof deferredPickupLabel>>;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-indigo-300/60 bg-indigo-50 p-4 dark:border-indigo-800 dark:bg-indigo-950/30">
      <CalendarClock
        className="h-6 w-6 shrink-0 text-indigo-700 dark:text-indigo-300"
        aria-hidden="true"
      />
      <div>
        <p className="font-semibold text-indigo-900 dark:text-indigo-100">
          Prévue pour {deferred.day} à {deferred.time}
        </p>
        <p className="text-sm text-foreground/60">
          Ta commande sera préparée le jour du retrait. Cette page passera à «
          En préparation » dès qu’on s’y met.
        </p>
      </div>
    </div>
  );
}

export function StockAlert() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-warning/30 bg-warning/15 p-4">
      <XCircle className="h-6 w-6 shrink-0 text-warning-700 dark:text-warning" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-warning-700 dark:text-warning">
          Un article n&apos;est plus disponible
        </p>
        <p className="text-sm text-foreground/60">
          Contacte-nous avant de payer — un autre client a pris la dernière
          quantité.
        </p>
      </div>
    </div>
  );
}
