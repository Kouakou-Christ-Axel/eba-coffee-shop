'use client';

import { Fragment } from 'react';
import Link from 'next/link';
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Loader2,
  Pencil,
  Receipt,
  Trash2,
} from 'lucide-react';
import { TableCell, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { priceFmt } from './format';
import { ExpenseItemDetails } from './expense-item-details';
import type { ExpenseRow as ExpenseRowData } from './types';

export function ExpenseRow({
  e,
  isExpanded,
  isPending,
  onToggle,
  onRemove,
}: {
  e: ExpenseRowData;
  isExpanded: boolean;
  isPending: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  return (
    <Fragment>
      <TableRow>
        <TableCell className="pr-0">
          {e.items.length > 0 && (
            <Button
              size="icon"
              variant="ghost"
              className="size-6"
              onClick={() => onToggle()}
              aria-label={isExpanded ? 'Masquer le détail' : 'Voir le détail'}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          )}
        </TableCell>
        <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
          {e.receiptNo ?? '—'}
        </TableCell>
        <TableCell className="whitespace-nowrap font-mono text-sm">
          {e.date}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1.5">
            <Badge variant="secondary">{e.categoryName}</Badge>
            {e.items.length > 0 && (
              <Badge
                variant="outline"
                className="cursor-pointer whitespace-nowrap"
                onClick={() => onToggle()}
              >
                {e.items.length} article
                {e.items.length > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </TableCell>
        <TableCell className="tabular-nums">
          {priceFmt.format(e.amount)} F
        </TableCell>
        <TableCell className="text-sm">{e.paymentLabel}</TableCell>
        <TableCell className="text-sm">{e.supplier ?? '—'}</TableCell>
        <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground">
          {e.note ?? '—'}
        </TableCell>
        <TableCell>
          {e.receiptUrl ? (
            <a
              href={e.receiptUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-primary hover:underline"
              aria-label="Voir le justificatif"
            >
              <Receipt className="h-4 w-4" />
            </a>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end">
            <Button
              asChild
              size="icon"
              variant="ghost"
              aria-label="Modifier la dépense"
            >
              <Link href={`/dashboard/depenses/${e.id}`}>
                <Pencil className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="icon"
              variant="ghost"
              aria-label="Dupliquer la dépense"
            >
              <Link href={`/dashboard/depenses/nouvelle?dupliquer=${e.id}`}>
                <Copy className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onRemove()}
              disabled={isPending}
              aria-label="Supprimer la dépense"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 text-destructive" />
              )}
            </Button>
          </div>
        </TableCell>
      </TableRow>
      {isExpanded && e.items.length > 0 && (
        <TableRow className="bg-muted/40 hover:bg-muted/40">
          <TableCell />
          <TableCell colSpan={9} className="py-2">
            <ExpenseItemDetails items={e.items} />
          </TableCell>
        </TableRow>
      )}
    </Fragment>
  );
}
