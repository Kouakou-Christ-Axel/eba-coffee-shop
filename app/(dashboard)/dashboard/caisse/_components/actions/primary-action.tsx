'use client';

import { Check, ChefHat, CheckCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { priceFormatter } from '@/config/menu';
import { getNextAction } from '@/lib/orders/progress';
import type { CashierOrder } from '@/lib/cashier-queue';
import type { OrderActions } from './use-order-actions';
import type { OrderView } from './use-order-view';

/** LA prochaine étape de la commande, en grand : le caissier n'a pas à lire la pile de boutons. */
export function PrimaryAction({
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
    pendingAction,
    isPending,
    setIsPaymentOpen,
    setIsDepositOpen,
    handleStartPreparation,
    handleStatusChange,
  } = actions;
  const next = getNextAction(order, { needsDeposit });
  if (!next) return null;

  const config = {
    deposit: {
      key: 'deposit',
      Icon: Check,
      label: `Encaisser l’acompte (${priceFormatter.format(depositRemaining)})`,
      run: () => setIsDepositOpen(true),
    },
    pay: {
      key: 'payment',
      Icon: Check,
      label: payLabel,
      run: () => setIsPaymentOpen(true),
    },
    'start-preparation': {
      key: 'status:PREPARING',
      Icon: ChefHat,
      label: 'Lancer la préparation',
      run: handleStartPreparation,
    },
    'mark-ready': {
      key: 'status:READY',
      Icon: CheckCheck,
      label: 'Marquer prête',
      run: () => handleStatusChange('READY'),
    },
    'mark-completed': {
      key: 'status:COMPLETED',
      Icon: CheckCheck,
      label: 'Marquer récupérée',
      run: () => handleStatusChange('COMPLETED'),
    },
  }[next];

  return (
    <Button
      type="button"
      size="lg"
      className="h-14 w-full text-base"
      disabled={isPending}
      onClick={config.run}
    >
      {pendingAction === config.key ? (
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      ) : (
        <config.Icon className="mr-2 h-5 w-5" />
      )}
      {config.label}
    </Button>
  );
}
