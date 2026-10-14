'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, Search, SearchX, X } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  ignoreNestedModalInteraction,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getPickupCode } from '@/lib/orders/format';
import { parseOrderSearchTerm, searchOrders } from '@/lib/orders/search';
import { formatPickup, isScheduledAhead } from '@/lib/orders/scheduling';
import type { PreparationOrder } from '@/lib/preparation-queue';

type Props = {
  orders: PreparationOrder[];
  now: Date;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ouvre le détail agrandi de la commande choisie. */
  onSelect: (id: string) => void;
};

// Même palette que les pastilles d'onglet de la recherche caisse.
const STATUS_PILL = {
  cooking: {
    label: 'À cuisiner',
    className:
      'bg-blue-100 text-blue-900 dark:bg-blue-950/60 dark:text-blue-100',
  },
  ready: {
    label: 'Prête',
    className:
      'bg-green-100 text-green-900 dark:bg-green-950/60 dark:text-green-100',
  },
  scheduled: {
    label: 'Programmée',
    className:
      'bg-indigo-100 text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-100',
  },
} as const;

function statusOf(order: PreparationOrder, now: Date) {
  if (order.status === 'READY') return STATUS_PILL.ready;
  if (order.status === 'PREPARING' && !isScheduledAhead(order, now)) {
    return STATUS_PILL.cooking;
  }
  return STATUS_PILL.scheduled;
}

/**
 * Recherche d'une commande en cuisine : code de retrait, n° du jour, nom ou
 * téléphone — même moteur que la caisse (`searchOrders`). Filtrage en mémoire
 * sur le flux SSE (toutes les commandes en cuisine, prêtes et programmées),
 * donc instantané et sans debounce. Toucher un résultat ouvre le détail.
 */
export function OrdersSearchSheet({
  orders,
  now,
  open,
  onOpenChange,
  onSelect,
}: Props) {
  const [term, setTerm] = useState('');
  const parsed = useMemo(() => parseOrderSearchTerm(term), [term]);
  const results = useMemo(
    () => (parsed ? searchOrders(orders, parsed) : []),
    [orders, parsed]
  );

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) setTerm('');
        onOpenChange(o);
      }}
    >
      <SheetContent
        side="bottom"
        className="h-[70vh] max-h-[90vh] gap-0 rounded-t-3xl p-0"
        onPointerDownOutside={ignoreNestedModalInteraction}
        onFocusOutside={ignoreNestedModalInteraction}
      >
        <SheetHeader className="gap-3 border-b p-5 pr-14">
          <SheetTitle className="flex items-center gap-2 text-xl">
            <Search className="h-5 w-5" />
            Rechercher une commande
          </SheetTitle>
          <SheetDescription className="sr-only">
            Par code de retrait, numéro du jour, nom ou téléphone du client.
          </SheetDescription>
          <div className="relative w-full">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              autoFocus
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Code de retrait, n°, nom ou téléphone…"
              aria-label="Rechercher une commande"
              className="h-11 pl-8 pr-9 text-base"
            />
            {term && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setTerm('')}
                aria-label="Effacer la recherche"
                className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4">
          {!parsed ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Tapez un code de retrait, un n°, un nom ou un téléphone.
            </p>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border bg-card p-8 text-center">
              <SearchX className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">
                Aucune commande en cuisine ne correspond à « {parsed.raw} »
              </p>
              <Link
                href={`/dashboard/commandes?search=${encodeURIComponent(parsed.raw)}`}
                className="text-sm font-semibold text-primary underline-offset-2 hover:underline"
              >
                Chercher dans toutes les commandes →
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-muted-foreground">
                {results.length} résultat{results.length > 1 ? 's' : ''}
              </p>
              <ul className="space-y-3">
                {results.map((order) => {
                  const status = statusOf(order, now);
                  return (
                    <li key={order.id}>
                      <button
                        type="button"
                        onClick={() => onSelect(order.id)}
                        className="flex w-full flex-col gap-1.5 rounded-2xl border-2 bg-card p-4 text-left shadow-sm transition-colors hover:bg-muted/40 active:bg-muted/60"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-2xl font-bold leading-none">
                            #{String(order.dailyNumber).padStart(3, '0')}
                          </span>
                          <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-lg font-bold text-primary">
                            {getPickupCode(order.reference)}
                          </span>
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-xs font-semibold',
                              status.className
                            )}
                          >
                            {status.label}
                          </span>
                          {!order.isPaid && (
                            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-900 dark:bg-orange-950/60 dark:text-orange-100">
                              Non payée
                            </span>
                          )}
                        </div>
                        <p className="flex items-center justify-between gap-3 text-base">
                          <span className="truncate font-medium">
                            {order.customerName ?? 'Client anonyme'}
                          </span>
                          {order.pickupTime && (
                            <span className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-indigo-900 dark:text-indigo-100">
                              <CalendarClock className="h-4 w-4" />
                              {formatPickup(order.pickupTime, now)}
                            </span>
                          )}
                        </p>
                        <p className="truncate text-sm text-muted-foreground">
                          {order.items
                            .map((i) => `${i.quantity}× ${i.productName}`)
                            .join(' · ')}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
