'use client';

import { useState } from 'react';
import { BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { todayDateString } from '@/lib/timezone';
import {
  ExpenseForm,
  emptyExpense,
  type ExpenseFormValues,
} from './expense-form';

type Category = { id: string; name: string };

type Missing = {
  id: string;
  label: string;
  categoryId: string;
  categoryName: string;
  expectedAmount: number | null;
};

/**
 * Bandeau d'alerte listant les dépenses récurrentes non saisies ce mois-ci.
 * Un clic ouvre un Sheet de saisie pré-rempli (catégorie + montant attendu).
 */
export function RecurringAlert({
  missing,
  categories,
}: {
  missing: Missing[];
  categories: Category[];
}) {
  const [open, setOpen] = useState(false);
  const [initial, setInitial] = useState<ExpenseFormValues>(() =>
    emptyExpense(categories)
  );
  const [activeLabel, setActiveLabel] = useState('');

  if (missing.length === 0) return null;

  function openFor(m: Missing) {
    setActiveLabel(m.label);
    setInitial({
      ...emptyExpense(categories),
      date: todayDateString(),
      categoryId: m.categoryId,
      amount: m.expectedAmount ? String(m.expectedAmount) : '',
      note: m.label,
    });
    setOpen(true);
  }

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <BellRing className="h-4 w-4 text-amber-600" />
        <span className="text-sm font-medium text-amber-900 dark:text-amber-200">
          Dépenses récurrentes non saisies ce mois-ci :
        </span>
        <div className="flex flex-wrap gap-2">
          {missing.map((m) => (
            <Button
              key={m.id}
              size="sm"
              variant="outline"
              className="h-7 border-amber-300 bg-background"
              onClick={() => openFor(m)}
            >
              {m.label}
            </Button>
          ))}
        </div>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Saisir « {activeLabel} »</SheetTitle>
            <SheetDescription>
              Dépense récurrente de ce mois, pré-remplie d’après le modèle.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4">
            <ExpenseForm
              key={`${initial.categoryId}-${open}`}
              categories={categories}
              // Pas d'autocomplétion ici : une récurrente (loyer, abonnement…)
              // se saisit sans détail par article.
              articles={[]}
              mode="create"
              initial={initial}
              onSuccess={() => setOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
