'use client';

import {
  Pencil,
  CalendarClock,
  Ban,
  RotateCcw,
  UserCog,
  Gift,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CashierOrder } from '@/lib/cashier-queue';
import type { OrderActions } from './use-order-actions';
import type { OrderView } from './use-order-view';

export function EditSection({
  order,
  view,
  actions,
}: {
  order: CashierOrder;
  view: OrderView;
  actions: OrderActions;
}) {
  const { canEditItems, canEditLoyalty } = view;
  const {
    isPending,
    actionError,
    setIsEditOpen,
    setIsEditFulfillmentOpen,
    setIsEditCustomerOpen,
    setIsEditLoyaltyOpen,
    handleCancelOrRefund,
  } = actions;
  return (
    <>
      {/* Ajouter / retirer des produits */}
      {canEditItems && (
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full text-muted-foreground"
          onClick={() => setIsEditOpen(true)}
        >
          <Pencil className="mr-1.5 h-4 w-4" />
          Modifier les articles
        </Button>
      )}

      {/* Prise en charge : type, créneau, livreur */}
      {canEditItems && (
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full text-muted-foreground"
          onClick={() => setIsEditFulfillmentOpen(true)}
        >
          <CalendarClock className="mr-1.5 h-4 w-4" />
          Modifier la prise en charge
        </Button>
      )}

      {/* Infos client : nom, téléphone, fiche CRM */}
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full text-muted-foreground"
        onClick={() => setIsEditCustomerOpen(true)}
      >
        <UserCog className="mr-1.5 h-4 w-4" />
        Modifier le client
      </Button>

      {/* Récompense fidélité, même sur une commande terminée */}
      {canEditLoyalty && (
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full text-muted-foreground"
          onClick={() => setIsEditLoyaltyOpen(true)}
        >
          <Gift className="mr-1.5 h-4 w-4" />
          Récompense fidélité
        </Button>
      )}

      {/* Annuler / Rembourser : rembourser si déjà payée, sinon annuler */}
      {order.status !== 'CANCELLED' && (
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={isPending}
          onClick={handleCancelOrRefund}
        >
          {order.isPaid ? (
            <>
              <RotateCcw className="mr-1.5 h-4 w-4" />
              Rembourser
            </>
          ) : (
            <>
              <Ban className="mr-1.5 h-4 w-4" />
              Annuler
            </>
          )}
        </Button>
      )}

      {actionError && <p className="text-xs text-destructive">{actionError}</p>}
    </>
  );
}
