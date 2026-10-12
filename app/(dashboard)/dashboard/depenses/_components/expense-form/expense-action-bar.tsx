'use client';

import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ExpenseFormState } from './use-expense-form';

const priceFmt = new Intl.NumberFormat('fr-FR');

export function ExpenseActionBar({ form }: { form: ExpenseFormState }) {
  const { values, detailed, total, busy, pending, mode, router, cancelHref } =
    form;
  return (
    <div className="sticky bottom-0 -mx-4 border-t bg-background px-4 py-3 sm:-mx-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {detailed
            ? `${values.items.length} article${values.items.length > 1 ? 's' : ''} · `
            : ''}
          Total{' '}
          <span className="font-semibold tabular-nums text-foreground">
            {priceFmt.format(detailed ? total : Number(values.amount) || 0)} F
          </span>
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => router.push(cancelHref)}
          >
            Annuler
          </Button>
          <Button
            onClick={form.submit}
            disabled={busy}
            className={cn(busy && 'opacity-70')}
          >
            {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {mode === 'edit'
              ? 'Enregistrer les modifications'
              : 'Enregistrer la dépense'}
          </Button>
        </div>
      </div>
    </div>
  );
}
