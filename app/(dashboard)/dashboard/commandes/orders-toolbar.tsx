'use client';

// Barre de filtres de la liste des commandes. Détient l'unique transition de
// navigation (via `useOrdersNavValue`) et la partage à tous les contrôles, qui
// restent ainsi réactifs et s'atténuent ensemble pendant le chargement.

import { Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DateRangeFilter } from '@/components/(dashboard)/date-range-filter';
import { StatusTabs } from './status-tabs';
import { OrderSearch } from './order-search';
import { PaymentFilter } from './payment-filter';
import { SortSelect } from './sort-select';
import { OrdersNavProvider, useOrdersNavValue } from './use-orders-nav';

type Props = {
  status?: string;
  payment?: string;
  sort?: string;
  search: string;
  from: string;
  to: string;
  isAll: boolean;
  exportHref: string;
};

export function OrdersToolbar({
  status,
  payment,
  sort,
  search,
  from,
  to,
  isAll,
  exportHref,
}: Props) {
  const nav = useOrdersNavValue();

  return (
    <OrdersNavProvider value={nav}>
      <div
        aria-busy={nav.isPending}
        className={cn(
          'space-y-4 transition-opacity',
          nav.isPending && 'pointer-events-none opacity-60'
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <DateRangeFilter
            from={from}
            to={to}
            isAll={isAll}
            showDayNav
            navigate={nav.navigate}
          />
          <Button asChild variant="outline" size="sm">
            <a href={exportHref}>
              <Download className="mr-1.5 h-4 w-4" />
              Exporter CSV
            </a>
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <StatusTabs activeStatus={status} />
          <div className="flex flex-wrap items-center gap-2">
            <PaymentFilter value={payment} />
            <SortSelect value={sort} />
            <OrderSearch initial={search} />
          </div>
        </div>
      </div>
    </OrdersNavProvider>
  );
}
