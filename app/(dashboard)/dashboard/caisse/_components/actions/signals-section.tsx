'use client';

import { Check, BellOff, AlertTriangle, Bot, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CashierOrder } from '@/lib/cashier-queue';
import type { OrderActions } from './use-order-actions';
import type { OrderView } from './use-order-view';

export function SignalsSection({
  order,
  view,
  actions,
}: {
  order: CashierOrder;
  view: OrderView;
  actions: OrderActions;
}) {
  const { hasStockShortage } = view;
  const {
    pendingAction,
    isPending,
    handleValidateWaveProof,
    handleDismissDriverRequest,
    handleUndoAutoValidation,
  } = actions;
  return (
    <>
      {/* Dismiss signal cuisine (livreur demandé) */}
      {order.driverRequested && (
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-100"
          disabled={isPending}
          onClick={handleDismissDriverRequest}
        >
          {pendingAction === 'driver' ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <BellOff className="mr-1.5 h-4 w-4" />
          )}
          Demande livreur gérée
        </Button>
      )}

      {/* Signal informatif : si l'action bute sur le stock, la feuille « vous les avez produits ? » prend le relais. */}
      {hasStockShortage && (
        <div className="flex items-center gap-2 rounded-lg bg-red-100 px-3 py-2 text-xs font-medium text-red-900 ring-1 ring-red-300 dark:bg-red-950/40 dark:text-red-100 dark:ring-red-800">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Stock épuisé : {order.unavailableItemNames.join(', ')} — produire ou
            proposer un remplacement.
          </span>
        </div>
      )}

      {/* Preuve Wave reçue : validation en un clic (mode WAVE) */}
      {order.paymentProofUrl &&
        !order.isPaid &&
        order.status !== 'CANCELLED' && (
          <Button
            type="button"
            variant="default"
            size="lg"
            className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
            disabled={isPending}
            onClick={handleValidateWaveProof}
          >
            {pendingAction === 'wave-proof' ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-1.5 h-4 w-4" />
            )}
            Valider le paiement Wave
          </Button>
        )}

      {/* Retour arrière sans limite de temps : personne n'était devant l'écran. */}
      {order.isPaid &&
        order.paymentAutoValidatedByAi &&
        order.status !== 'CANCELLED' && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
            disabled={isPending}
            onClick={handleUndoAutoValidation}
          >
            {pendingAction === 'undo-ai' ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Bot className="mr-1.5 h-4 w-4" />
            )}
            Annuler l&apos;encaissement automatique
          </Button>
        )}
    </>
  );
}
