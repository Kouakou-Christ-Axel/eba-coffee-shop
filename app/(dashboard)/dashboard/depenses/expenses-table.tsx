'use client';

import { useMemo, useState, useTransition } from 'react';
import { Settings2 } from 'lucide-react';
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
import { deleteExpenseAction } from './actions';
import { CategoryManager, type CategoryRow } from './category-manager';
import { ExpenseRow } from './_components/expenses-table/expense-row';
import { PaymentTotals } from './_components/expenses-table/payment-totals';
import type { ExpenseRow as ExpenseRowData } from './_components/expenses-table/types';

export type {
  ExpenseItemRow,
  ExpenseRow,
} from './_components/expenses-table/types';

export function ExpensesTable({
  expenses,
  categories,
  total,
}: {
  expenses: ExpenseRowData[];
  categories: CategoryRow[];
  total: number;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  // Lignes dépliées (détail par article visible).
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Sheet de gestion des catégories.
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  // Sous-totaux par mode de paiement sur la sélection courante.
  const byPaymentMethod = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses) {
      map.set(e.paymentLabel, (map.get(e.paymentLabel) ?? 0) + e.amount);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCategoriesOpen(true)}
        >
          <Settings2 className="mr-1.5 h-4 w-4" />
          Gérer les catégories
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>N° reçu</TableHead>
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
              <ExpenseRow
                key={e.id}
                e={e}
                isExpanded={expanded.has(e.id)}
                isPending={pendingId === e.id}
                onToggle={() => toggleExpanded(e.id)}
                onRemove={() => remove(e.id)}
              />
            ))}
            {expenses.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={10}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  Aucune dépense sur cette sélection.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <PaymentTotals byPaymentMethod={byPaymentMethod} total={total} />

      {/* Sheet de gestion des catégories */}
      <Sheet open={categoriesOpen} onOpenChange={setCategoriesOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Catégories</SheetTitle>
            <SheetDescription>
              Catégories de dépense et leur nature (fixe / variable).
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4">
            <CategoryManager categories={categories} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
