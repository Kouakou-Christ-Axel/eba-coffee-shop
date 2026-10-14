'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, SearchX, X } from 'lucide-react';
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
import { parseOrderSearchTerm, searchOrders } from '@/lib/orders/search';
import type { PreparationOrder } from '@/lib/preparation-queue';
import { buildQueueEntries } from '@/lib/orders/customer-groups';
import type { KitchenGroup } from '@/lib/orders/kitchen-group';
import { GroupFrame } from './group/group-frame';
import { SearchResultRow, type SearchRowCallbacks } from './orders-search-row';

type Props = SearchRowCallbacks & {
  orders: PreparationOrder[];
  /** Commandes en cours d'action (spinner + double-clic bloqué). */
  pendingIds: Set<string>;
  now: Date;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ouvre le détail agrandi de la commande choisie. */
  onSelect: (id: string) => void;
  /** Clients à plusieurs commandes : leurs résultats se rangent dans un même cadre. */
  groups: Map<string, KitchenGroup>;
};

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
  groups,
  pendingIds,
  ...rowCallbacks
}: Props) {
  const [term, setTerm] = useState('');
  const parsed = useMemo(() => parseOrderSearchTerm(term), [term]);
  const results = useMemo(
    () => (parsed ? searchOrders(orders, parsed) : []),
    [orders, parsed]
  );

  const row = (order: PreparationOrder) => (
    <SearchResultRow
      key={order.id}
      order={order}
      now={now}
      pending={pendingIds.has(order.id)}
      onSelect={onSelect}
      {...rowCallbacks}
    />
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
              className="h-11 pl-8 pr-9 text-base [&::-webkit-search-cancel-button]:hidden"
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
                {buildQueueEntries(results, groups).map((entry) =>
                  entry.kind === 'single' ? (
                    row(entry.order)
                  ) : (
                    <GroupFrame
                      key={entry.group.key}
                      group={entry.group}
                      label={`${entry.group.orders.length} commandes ensemble`}
                    >
                      {entry.inTab.map(row)}
                    </GroupFrame>
                  )
                )}
              </ul>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
