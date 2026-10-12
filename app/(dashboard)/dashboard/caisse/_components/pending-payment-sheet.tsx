'use client';

import { Clock } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { PendingRow } from './pending-payment/pending-row';
import { usePendingOrders } from './pending-payment/use-pending-orders';

/**
 * Tiroir « En attente de paiement » : les commandes en ligne pas encore payées sont
 * masquées de la file caisse (ni cuisine ni stats tant que l'argent n'est pas
 * arrivé). Ici le caissier les voit pour :
 *   - relancer le client (appel, WhatsApp avec le lien de suivi, où il relance
 *     lui-même le paiement) ;
 *   - la PRENDRE EN CAISSE : elle devient une commande ordinaire, encaissée par les
 *     moyens habituels (espèces, Wave…), sans Jèko ni frais ;
 *   - l'annuler.
 *
 * Lecture à la demande hors flux SSE : la liste (petite) est relue toutes les 30 s
 * pour tenir le compteur à jour, et à chaque ouverture.
 */
export function PendingPaymentSheet() {
  const {
    open,
    orders,
    loaded,
    now,
    error,
    busyId,
    confirmCancelId,
    setConfirmCancelId,
    handleOpenChange,
    takeInCashier,
    cancel,
  } = usePendingOrders();

  const count = orders.length;

  return (
    <>
      <button
        type="button"
        onClick={() => handleOpenChange(true)}
        aria-label={`Commandes en attente de paiement${count ? ` (${count})` : ''}`}
        title="Commandes en attente de paiement"
        className="relative rounded-full bg-muted p-2 text-muted-foreground transition-colors hover:bg-muted/80"
      >
        <Clock className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
            {count}
          </span>
        )}
      </button>

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="bottom"
          className="h-[70vh] max-h-[90vh] gap-0 rounded-t-3xl p-0"
        >
          <SheetHeader className="border-b p-5 pr-14">
            <SheetTitle className="flex items-center gap-2 text-xl">
              <Clock className="h-5 w-5" />
              En attente de paiement
            </SheetTitle>
            <SheetDescription>
              Commandes en ligne pas encore payées : invisibles en cuisine tant
              que l’argent n’est pas arrivé. Relancez le client, ou prenez la
              commande en caisse.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4">
            {error && (
              <p className="mb-3 rounded-lg bg-red-100 px-3 py-2 text-sm font-medium text-red-900 dark:bg-red-950/60 dark:text-red-100">
                {error}
              </p>
            )}

            {!loaded ? (
              <p className="py-8 text-center text-muted-foreground">
                Chargement…
              </p>
            ) : orders.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                Aucune commande en attente de paiement.
              </p>
            ) : (
              <ul className="space-y-3">
                {orders.map((o) => (
                  <PendingRow
                    key={o.id}
                    order={o}
                    now={now}
                    busy={busyId === o.id}
                    confirmingCancel={confirmCancelId === o.id}
                    onTake={() => takeInCashier(o.id)}
                    onAskCancel={() => setConfirmCancelId(o.id)}
                    onCancel={() => cancel(o.id)}
                    onKeep={() => setConfirmCancelId(null)}
                  />
                ))}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
