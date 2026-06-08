'use client';

import { useState, useTransition } from 'react';
import { Loader2, Receipt, Trash2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { deleteExpenseAction } from './actions';

export type ExpenseRow = {
  id: string;
  date: string;
  amount: number;
  paymentLabel: string;
  supplier: string | null;
  note: string | null;
  receiptUrl: string | null;
  categoryName: string;
};

const priceFmt = new Intl.NumberFormat('fr-FR');

export function ExpensesTable({
  expenses,
  total,
}: {
  expenses: ExpenseRow[];
  total: number;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function remove(id: string) {
    setError(null);
    setPendingId(id);
    startTransition(async () => {
      const r = await deleteExpenseAction(id);
      setPendingId(null);
      if (!r.ok) setError(r.error);
    });
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead>Montant</TableHead>
              <TableHead>Paiement</TableHead>
              <TableHead>Fournisseur</TableHead>
              <TableHead>Note</TableHead>
              <TableHead>Justif.</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="whitespace-nowrap font-mono text-sm">
                  {e.date}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{e.categoryName}</Badge>
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
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => remove(e.id)}
                    disabled={pendingId === e.id}
                    aria-label="Supprimer la dépense"
                  >
                    {pendingId === e.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 text-destructive" />
                    )}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {expenses.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  Aucune dépense sur cette sélection.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex justify-end gap-2 text-sm">
        <span className="text-muted-foreground">Total :</span>
        <span className="font-bold tabular-nums">
          {priceFmt.format(total)} F
        </span>
      </div>
    </div>
  );
}
