'use client';

// Tableau clients (TanStack Table, headless) au-dessus des primitives shadcn
// (`components/ui/table`, cf. politique UI — Table = shadcn). Le tri est
// BACKEND (`manualSorting`) : un clic sur un en-tête change `sort`/`dir` dans
// l'URL (nuqs, cf. `use-clients-nav.ts`), et `lib/customers.ts::listCustomers`
// trie/pagine sur l'ensemble des clients — pas seulement la page affichée.

import Link from 'next/link';
import {
  type ColumnDef,
  type OnChangeFn,
  type SortingState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, Handshake } from 'lucide-react';
import type { CustomerStats } from '@/lib/customers';
import { formatPhoneForDisplay } from '@/lib/phone';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { CUSTOMER_SORT_KEYS } from './search-params';
import { useClientsNav } from './use-clients-nav';
import { useCustomerStats } from './use-customer-stats';

const priceFmt = new Intl.NumberFormat('fr-FR');
const dateFmt = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export type CustomerRow = {
  id: string;
  name: string | null;
  phone: string;
  isTrusted: boolean;
  trustedNote: string | null;
  /** `null` tant que les stats ne sont pas arrivées (cf. use-customer-stats.ts). */
  stats: CustomerStats | null;
};

const StatSkeleton = () => (
  <span
    className="inline-block h-4 w-12 animate-pulse rounded bg-muted"
    aria-label="Chargement"
  />
);

const columns: ColumnDef<CustomerRow>[] = [
  {
    id: 'name',
    header: 'Nom',
    cell: ({ row }) => (
      <Link
        href={`/dashboard/clients/${row.original.id}`}
        className="inline-block py-1.5 font-medium hover:underline"
      >
        {row.original.name ?? '—'}
      </Link>
    ),
  },
  {
    id: 'phone',
    header: 'Téléphone',
    enableSorting: false,
    cell: ({ row }) => (
      <span className="font-mono text-sm">
        {formatPhoneForDisplay(row.original.phone)}
      </span>
    ),
  },
  {
    id: 'trusted',
    header: 'Confiance',
    enableSorting: false,
    cell: ({ row }) =>
      row.original.isTrusted ? (
        <Badge
          className="bg-blue-600"
          title={row.original.trustedNote ?? undefined}
        >
          <Handshake className="h-3 w-3" aria-hidden="true" />
          Confiance
        </Badge>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    id: 'ordersCount',
    header: 'Commandes',
    cell: ({ row }) =>
      row.original.stats ? (
        <span className="tabular-nums">{row.original.stats.ordersCount}</span>
      ) : (
        <StatSkeleton />
      ),
  },
  {
    id: 'totalSpent',
    header: 'Total acheté',
    cell: ({ row }) =>
      row.original.stats ? (
        <span className="tabular-nums">
          {priceFmt.format(row.original.stats.totalSpent)} F
        </span>
      ) : (
        <StatSkeleton />
      ),
  },
  {
    id: 'lastOrderAt',
    header: 'Dernière commande',
    cell: ({ row }) =>
      row.original.stats ? (
        <span className="text-sm text-muted-foreground">
          {row.original.stats.lastOrderAt
            ? dateFmt.format(row.original.stats.lastOrderAt)
            : '—'}
        </span>
      ) : (
        <StatSkeleton />
      ),
  },
];

// Seules ces colonnes correspondent à un `CustomerSortKey` que le serveur
// sait trier (cf. lib/customers.ts) ; les autres restent `enableSorting: false`.
const SORTABLE = new Set<string>(CUSTOMER_SORT_KEYS);

export function CustomersTable({ customers }: { customers: CustomerRow[] }) {
  const { filters, update, isPending } = useClientsNav();
  const { sort, dir, search } = filters;

  // Tri sur une stat : le serveur les a déjà (`stats` non nul), rien à charger.
  const fetched = useCustomerStats(customers.some((c) => !c.stats));
  const rows = customers.map((c) => ({
    ...c,
    stats: c.stats ?? fetched?.[c.id] ?? null,
  }));

  const sorting: SortingState = sort
    ? [{ id: sort, desc: dir === 'desc' }]
    : [];

  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    const next = typeof updater === 'function' ? updater(sorting) : updater;
    const first = next[0];
    update(
      first
        ? { sort: first.id as typeof sort, dir: first.desc ? 'desc' : 'asc' }
        : { sort: null, dir: null }
    );
  };

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: handleSortingChange,
    manualSorting: true,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div
      aria-busy={isPending}
      className={cn(
        'overflow-x-auto transition-opacity',
        isPending && 'opacity-60'
      )}
    >
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const sortable = SORTABLE.has(header.column.id);
                const sortState = header.column.getIsSorted();
                return (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : sortable ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="flex min-h-9 items-center gap-1 hover:text-foreground"
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {sortState === 'asc' ? (
                          <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : sortState === 'desc' ? (
                          <ArrowDown
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                        ) : (
                          <ArrowUpDown
                            className="h-3.5 w-3.5 text-muted-foreground/50"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    ) : (
                      flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
          {customers.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="py-8 text-center text-muted-foreground"
              >
                {search
                  ? 'Aucun client pour cette recherche.'
                  : 'Aucun client à afficher.'}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
