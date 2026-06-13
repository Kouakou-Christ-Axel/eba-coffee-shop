'use client';

import { useState, useTransition } from 'react';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { deleteRevenueAdjustmentAction } from './actions';
import {
  RevenueAdjustmentForm,
  emptyAdjustment,
  type RevenueAdjustmentFormValues,
} from './revenue-adjustment-form';

export type RevenueAdjustmentRow = {
  id: string;
  date: string;
  amount: number; // signé
  paymentLabel: string;
  paymentMode: string;
  note: string | null;
};

const priceFmt = new Intl.NumberFormat('fr-FR');

function formatSigned(amount: number): string {
  const sign = amount < 0 ? '−' : '+';
  return `${sign}${priceFmt.format(Math.abs(amount))} F`;
}

function rowToValues(r: RevenueAdjustmentRow): RevenueAdjustmentFormValues {
  return {
    id: r.id,
    date: r.date,
    direction: r.amount < 0 ? 'remove' : 'add',
    amount: String(Math.abs(r.amount)),
    paymentMode: r.paymentMode,
    note: r.note ?? '',
  };
}

export function RevenueAdjustmentsTable({
  adjustments,
  total,
}: {
  adjustments: RevenueAdjustmentRow[];
  total: number;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [formInitial, setFormInitial] = useState<RevenueAdjustmentFormValues>(
    () => emptyAdjustment()
  );

  function openCreate() {
    setFormMode('create');
    setFormInitial(emptyAdjustment());
    setFormOpen(true);
  }

  function openEdit(r: RevenueAdjustmentRow) {
    setFormMode('edit');
    setFormInitial(rowToValues(r));
    setFormOpen(true);
  }

  function remove(id: string) {
    setError(null);
    setPendingId(id);
    startTransition(async () => {
      const r = await deleteRevenueAdjustmentAction(id);
      setPendingId(null);
      if (!r.ok) setError(r.error);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          Nouvelle régularisation
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Montant</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead>Motif</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {adjustments.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="whitespace-nowrap font-mono text-sm">
                  {a.date}
                </TableCell>
                <TableCell
                  className={cn(
                    'tabular-nums font-medium',
                    a.amount < 0 ? 'text-destructive' : 'text-green-600'
                  )}
                >
                  {formatSigned(a.amount)}
                </TableCell>
                <TableCell className="text-sm">{a.paymentLabel}</TableCell>
                <TableCell className="max-w-[260px] truncate text-sm text-muted-foreground">
                  {a.note ?? '—'}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => openEdit(a)}
                      aria-label="Modifier la régularisation"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => remove(a.id)}
                      disabled={pendingId === a.id}
                      aria-label="Supprimer la régularisation"
                    >
                      {pendingId === a.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-destructive" />
                      )}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {adjustments.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  Aucune régularisation sur cette sélection.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-end gap-2 text-sm">
        <span className="text-muted-foreground">Total net :</span>
        <span
          className={cn(
            'font-bold tabular-nums',
            total < 0 ? 'text-destructive' : undefined
          )}
        >
          {formatSigned(total)}
        </span>
      </div>

      <Sheet open={formOpen} onOpenChange={setFormOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>
              {formMode === 'edit'
                ? 'Modifier la régularisation'
                : 'Nouvelle régularisation de recette'}
            </SheetTitle>
            <SheetDescription>
              Ajuste le CA sans créer de commande (ventes non saisies,
              correction…).
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4">
            <RevenueAdjustmentForm
              key={`${formMode}-${formInitial.id ?? 'new'}-${formOpen}`}
              mode={formMode}
              initial={formInitial}
              onSuccess={() => setFormOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
