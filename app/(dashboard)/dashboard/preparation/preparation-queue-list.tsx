'use client';

import { format, isPast, differenceInMinutes } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  AlertTriangle,
  Bike,
  Clock,
  Coffee,
  Inbox,
  ShoppingBag,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PreparationOrder } from '@/lib/preparation-queue';
import type { OrderType } from '@/generated/prisma/client';

const ORDER_TYPE_ICON: Record<OrderType, typeof Bike> = {
  DELIVERY: Bike,
  DINE_IN: Coffee,
  TAKEAWAY: ShoppingBag,
};

type Props = {
  orders: PreparationOrder[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function PreparationQueueList({ orders, selectedId, onSelect }: Props) {
  if (orders.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl border bg-card p-6 text-center text-muted-foreground">
        <Inbox className="h-8 w-8" />
        <p className="text-sm font-medium">Aucune commande</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col rounded-xl border bg-card">
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          File d&apos;attente
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {orders.length} commande{orders.length > 1 ? 's' : ''} à traiter
        </p>
      </div>
      <ul className="flex-1 divide-y overflow-y-auto">
        {orders.map((o) => {
          const isSelected = o.id === selectedId;
          const pickup = o.pickupTime;
          const minutesUntil = pickup
            ? differenceInMinutes(pickup, new Date())
            : null;
          const isLate = pickup ? isPast(pickup) : false;
          const isSoon = pickup ? !isLate && (minutesUntil ?? 0) <= 15 : false;
          const itemsCount = o.items.reduce((s, it) => s + it.quantity, 0);
          const TypeIcon = ORDER_TYPE_ICON[o.orderType];

          return (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => onSelect(o.id)}
                className={cn(
                  'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60',
                  isSelected &&
                    'bg-primary/10 ring-1 ring-inset ring-primary hover:bg-primary/15'
                )}
              >
                <div
                  className={cn(
                    'flex flex-col items-center justify-center rounded-lg px-2.5 py-1.5 text-center tabular-nums',
                    isLate
                      ? 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100'
                      : isSoon
                        ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100'
                        : 'bg-muted text-foreground'
                  )}
                >
                  <Clock className="mb-0.5 h-3.5 w-3.5" />
                  <span className="text-sm font-bold leading-none">
                    {pickup ? format(pickup, 'HH:mm', { locale: fr }) : 'ASAP'}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate font-mono text-xs font-semibold text-muted-foreground">
                    <TypeIcon className="h-3 w-3 shrink-0" />#
                    {String(o.dailyNumber).padStart(3, '0')}
                    {o.status === 'PREPARING' && (
                      <span className="ml-auto rounded-full bg-primary/15 px-1.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                        Prep
                      </span>
                    )}
                  </p>
                  <p className="truncate text-sm font-semibold">
                    {o.customerName ?? 'Client anonyme'}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    {itemsCount} article{itemsCount > 1 ? 's' : ''}
                    {o.driverRequested && (
                      <span
                        className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-300"
                        title="Livreur demandé"
                      >
                        <AlertTriangle className="h-3 w-3" />
                      </span>
                    )}
                  </p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
