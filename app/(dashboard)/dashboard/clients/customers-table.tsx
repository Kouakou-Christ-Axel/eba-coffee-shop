'use client';

// Tableau clients (TanStack Table, headless) au-dessus des primitives shadcn
// (`components/ui/table`, cf. politique UI — Table = shadcn). Le tri est
// CLIENT et ne porte que sur la page affichée : la pagination reste pilotée
// par le serveur (recherche floue + `skip/take`), un tri global sur tout le
// jeu de données nécessiterait un `ORDER BY` en base sur des stats calculées
// à la volée (hors scope ici, cf. `lib/customers.ts::statsByCustomer`).

import Link from 'next/link';
import { useState } from 'react';
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, Handshake } from 'lucide-react';
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
    accessorKey: 'name',
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
    accessorKey: 'phone',
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
    accessorFn: (c) => c.stats.ordersCount,
    header: 'Commandes',
    cell: ({ row }) => (
      <span className="tabular-nums">{row.original.stats.ordersCount}</span>
    ),
  },
  {
    id: 'totalSpent',
    accessorFn: (c) => c.stats.totalSpent,
    header: 'Total acheté',
    cell: ({ row }) => (
      <span className="tabular-nums">
        {priceFmt.format(row.original.stats.totalSpent)} F
      </span>
    ),
  },
  {
    id: 'lastOrderAt',
    accessorFn: (c) => c.stats.lastOrderAt?.getTime() ?? 0,
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

export function CustomersTable({ customers }: { customers: CustomerRow[] }) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data: customers,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const sortable = header.column.getCanSort();
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
