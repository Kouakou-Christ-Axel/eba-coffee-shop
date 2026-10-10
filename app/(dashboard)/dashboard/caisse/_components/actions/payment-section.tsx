'use client';

import { Check, ChefHat, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { priceFormatter } from '@/config/menu';
import type { CashierOrder } from '@/lib/cashier-queue';
import type { OrderActions } from './use-order-actions';
import type { OrderView } from './use-order-view';

export function PaymentSection({
  order,
  view,
  actions,
}: {
  order: CashierOrder;
  view: OrderView;
  actions: OrderActions;
}) {
  const { payLabel, depositRemaining, needsDeposit } = view;
  const {
    setIsPaymentOpen,
    setIsDepositOpen,
    pendingAction,
    isPending,
    handleStartPreparation,
    handleSendToKitchenWithoutPayment,
  } = actions;
  return (
    <>
      {/* Acompte non couvert : sans ce bouton, « lancer la préparation » échoue en 409. */}
      {needsDeposit && order.status !== 'CANCELLED' && (
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full border-amber-400 text-amber-900 hover:bg-amber-50 dark:text-amber-100"
          disabled={isPending}
          onClick={() => setIsDepositOpen(true)}
        >
          {pendingAction === 'deposit' ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Check className="mr-1.5 h-4 w-4" />
          )}
          Encaisser l&apos;acompte ({priceFormatter.format(depositRemaining)})
        </Button>
      )}

      {/* Action principale : marquer payée (pleine largeur) */}
      {!order.isPaid && order.status !== 'CANCELLED' && (
        <Button
          type="button"
          variant="default"
          size="lg"
          className="w-full"
          disabled={isPending}
          onClick={() => setIsPaymentOpen(true)}
        >
          <Check className="mr-1.5 h-4 w-4" />
          {payLabel}
        </Button>
      )}

      {/* Ardoise : cuisine sans encaissement (NEW seul). Masquée tant que `needsDeposit` : le clic échouerait en 409. */}
      {!order.isPaid && order.status === 'NEW' && !needsDeposit && (
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full text-muted-foreground"
          disabled={isPending}
          onClick={handleSendToKitchenWithoutPayment}
        >
          {pendingAction === 'status:PREPARING' ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <ChefHat className="mr-1.5 h-4 w-4" />
          )}
          {order.pickupTime
            ? 'Lancer la préparation (ardoise)'
            : 'Envoyer en cuisine (ardoise)'}
        </Button>
      )}

      {/* Programmée déjà payée : reste NEW jusqu'au jour du retrait ; seul chemin qui décompte son stock, volontairement manuel. */}
      {order.isPaid && order.status === 'NEW' && order.pickupTime && (
        <Button
          type="button"
          variant="default"
          size="lg"
          className="w-full"
          disabled={isPending}
          onClick={handleStartPreparation}
        >
          {pendingAction === 'status:PREPARING' ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <ChefHat className="mr-1.5 h-4 w-4" />
          )}
          Lancer la préparation
        </Button>
      )}
    </>
  );
}
