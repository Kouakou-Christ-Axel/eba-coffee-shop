'use client';

// Tableau clients (TanStack Table, headless) au-dessus des primitives shadcn
// (`components/ui/table`, cf. politique UI — Table = shadcn). Le tri est
// BACKEND (`manualSorting`) : un clic sur un en-tête change `sort`/`dir` dans
// l'URL (via `startTransition`, comme `customer-search.tsx` et
// `components/(dashboard)/pagination.tsx`), et `lib/customers.ts::listCustomers`
// trie/pagine sur l'ensemble des clients — pas seulement la page affichée.

import Link from 'next/link';
import { useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  type ColumnDef,
  type OnChangeFn,
  type SortingState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, Handshake } from 'lucide-react';
import type { CustomerSortKey, SortDir } from '@/lib/customers';
import { formatPhoneForDisplay } from '@/lib/phone';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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
  stats: {
    ordersCount: number;
    totalSpent: number;
    lastOrderAt: Date | null;
  };
};

const columns: ColumnDef<CustomerRow>[] = [
  {
    id: 'name',
    header: 'Nom',
    cell: ({ row }) => (
      <Link
        href={`/dashboard/clients/${row.original.id}`}
        className="font-medium hover:underline"
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
    cell: ({ row }) => (
      <span className="tabular-nums">{row.original.stats.ordersCount}</span>
    ),
  },
  {
    id: 'totalSpent',
    header: 'Total acheté',
    cell: ({ row }) => (
      <span className="tabular-nums">
        {priceFmt.format(row.original.stats.totalSpent)} F
      </span>
    ),
  },
  {
    id: 'lastOrderAt',
    header: 'Dernière commande',
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.stats.lastOrderAt
          ? dateFmt.format(row.original.stats.lastOrderAt)
          : '—'}
      </span>
    ),
  },
  {
    id: 'actions',
    header: '',
    enableSorting: false,
    cell: ({ row }) => (
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/dashboard/clients/${row.original.id}`}>Voir</Link>
      </Button>
    ),
  },
];

// Seules ces colonnes correspondent à un `CustomerSortKey` que le serveur
// sait trier (cf. lib/customers.ts) ; les autres restent `enableSorting: false`.
const SORT_KEY_BY_COLUMN: Partial<Record<string, CustomerSortKey>> = {
  name: 'name',
  ordersCount: 'ordersCount',
  totalSpent: 'totalSpent',
  lastOrderAt: 'lastOrderAt',
};

export function CustomersTable({
  customers,
  sort,
  dir,
}: {
  customers: CustomerRow[];
  sort?: CustomerSortKey;
  dir: SortDir;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const sorting: SortingState = sort
    ? [{ id: sort, desc: dir === 'desc' }]
    : [];

  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    const next = typeof updater === 'function' ? updater(sorting) : updater;
    const first = next[0];
    const params = new URLSearchParams(searchParams.toString());
    params.delete('page');
    if (first) {
      params.set('sort', first.id);
      params.set('dir', first.desc ? 'desc' : 'asc');
    } else {
      params.delete('sort');
      params.delete('dir');
    }
    startTransition(() => {
      router.push(`?${params.toString()}`, { scroll: false });
    });
  };

  const table = useReactTable({
    data: customers,
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
                const sortable =
                  SORT_KEY_BY_COLUMN[header.column.id] !== undefined;
                const sortState = header.column.getIsSorted();
                return (
                  <TableHead
                    key={header.id}
                    className={
                      header.id === 'actions' ? 'text-right' : undefined
                    }
                  >
                    {header.isPlaceholder ? null : sortable ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="flex items-center gap-1 hover:text-foreground"
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
                <TableCell
                  key={cell.id}
                  className={
                    cell.column.id === 'actions' ? 'text-right' : undefined
                  }
                >
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
                Aucun client pour cette recherche.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
