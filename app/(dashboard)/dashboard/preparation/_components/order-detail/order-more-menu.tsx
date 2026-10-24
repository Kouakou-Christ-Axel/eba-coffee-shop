'use client';

import { useState } from 'react';
import { MoreHorizontal, Pencil, UserCog, UserPlus } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { PreparationOrder } from '@/lib/preparation-queue';
import {
  AssociateCustomer,
  type AssociateCustomerAction,
} from '../../../_components/associate-customer';

// Menu « autres actions » du panneau de détail : modifier les articles et lier
// un client sont des gestes occasionnels, ils ne méritent pas chacun un bouton
// pleine largeur qui écrase la liste des articles. Menu shadcn (et non HeroUI) :
// il vit dans un Sheet Radix, dont le piège à focus bloquerait un popover HeroUI
// monté hors du Sheet.
export function OrderMoreMenu({
  order,
  customerAction,
  onEdit,
}: {
  order: PreparationOrder;
  customerAction?: AssociateCustomerAction;
  onEdit: () => void;
}) {
  const [customerOpen, setCustomerOpen] = useState(false);
  const isLinked = order.customerId !== null;
  const CustomerIcon = isLinked ? UserCog : UserPlus;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Autres actions"
            className="flex shrink-0 items-center justify-center rounded-xl border border-input bg-background px-4 py-4 text-muted-foreground transition-colors hover:bg-accent"
          >
            <MoreHorizontal className="h-6 w-6" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" className="min-w-56">
          <DropdownMenuItem
            className="gap-2 py-3 text-base"
            onSelect={() => onEdit()}
          >
            <Pencil className="h-5 w-5" />
            Modifier les articles
          </DropdownMenuItem>
          {customerAction && (
            <DropdownMenuItem
              className="gap-2 py-3 text-base"
              onSelect={() => setCustomerOpen(true)}
            >
              <CustomerIcon className="h-5 w-5" />
              {isLinked ? 'Modifier le client' : 'Associer un client'}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {customerAction && (
        <AssociateCustomer
          orderId={order.id}
          currentCustomerId={order.customerId}
          currentName={order.customerName}
          currentPhone={order.customerPhone}
          action={customerAction}
          controlled={{ isOpen: customerOpen, setIsOpen: setCustomerOpen }}
        />
      )}
    </>
  );
}
