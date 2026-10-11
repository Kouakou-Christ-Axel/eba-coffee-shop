'use client';

import { MessageCircle, CheckCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CashierOrder } from '@/lib/cashier-queue';
import type { OrderActions } from './use-order-actions';
import type { OrderView } from './use-order-view';

export function StatusSection({
  order,
  view,
  actions,
}: {
  order: CashierOrder;
  view: OrderView;
  actions: OrderActions;
}) {
  const { readyLink } = view;
  const { pendingAction, isPending, handleStatusChange } = actions;
  return (
    <>
      {/* Action préparation : marquer prête */}
      {order.status === 'PREPARING' && (
        <Button
          type="button"
          variant="default"
          size="lg"
          className="w-full"
          disabled={isPending}
          onClick={() => handleStatusChange('READY')}
        >
          {pendingAction === 'status:READY' ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <CheckCheck className="mr-1.5 h-4 w-4" />
          )}
          Marquer prête
        </Button>
      )}

      {/* Commande prête : prévenir le client en un tap (WhatsApp) */}
      {order.status === 'READY' && readyLink && (
        <Button asChild variant="outline" size="lg" className="w-full">
          <a href={readyLink} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="mr-1.5 h-4 w-4" />
            Prévenir&nbsp;: c&apos;est prêt
          </a>
        </Button>
      )}

      {/* Action remise : marquer récupérée */}
      {order.status === 'READY' && (
        <Button
          type="button"
          variant="default"
          size="lg"
          className="w-full"
          disabled={isPending}
          onClick={() => handleStatusChange('COMPLETED')}
        >
          {pendingAction === 'status:COMPLETED' ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <CheckCheck className="mr-1.5 h-4 w-4" />
          )}
          Marquer récupérée
        </Button>
      )}
    </>
  );
}
