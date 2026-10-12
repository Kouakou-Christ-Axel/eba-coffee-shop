'use client';

import { ChefHat, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  const { needsDeposit } = view;
  const { pendingAction, isPending, handleSendToKitchenWithoutPayment } =
    actions;
  return (
    <>
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
    </>
  );
}
