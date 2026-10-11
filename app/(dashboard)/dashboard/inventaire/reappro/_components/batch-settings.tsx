'use client';

import { Select, SelectItem } from '@heroui/react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import {
  PAYMENT_OPTIONS,
  formatDay,
  type PaymentMethod,
} from './restock-shared';
import type { RestockForm } from './use-restock-form';

/** Réglages du lot, repliés : date du jour, espèces et sans fournisseur couvrent la quasi-totalité des réceptions. */
export function BatchSettings({
  form,
  expenseCategories,
}: {
  form: RestockForm;
  expenseCategories: { id: string; name: string }[];
}) {
  const {
    date,
    setDate,
    supplier,
    setSupplier,
    paymentMethod,
    setPaymentMethod,
    note,
    setNote,
    createExpense,
    setCreateExpense,
    expenseCategoryId,
    setExpenseCategoryId,
    detailsOpen,
    setDetailsOpen,
    expenseBlocked,
  } = form;
  return (
    <Card className="p-3">
      <button
        type="button"
        onClick={() => setDetailsOpen((v) => !v)}
        aria-expanded={detailsOpen}
        className="flex min-h-11 w-full items-center justify-between gap-3 text-left"
      >
        <span className="min-w-0 truncate text-sm">
          <span className="font-medium">{formatDay(date)}</span>
          <span className="text-muted-foreground">
            {' · '}
            {PAYMENT_OPTIONS.find((p) => p.value === paymentMethod)?.label}
            {supplier.trim() ? ` · ${supplier.trim()}` : ''}
            {createExpense ? ' · dépense liée' : ''}
          </span>
        </span>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none',
            detailsOpen && 'rotate-180'
          )}
        />
      </button>

      {detailsOpen && (
        <div className="mt-3 space-y-3 border-t pt-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="restock-date">Date</Label>
              <Input
                id="restock-date"
                type="date"
                className="h-11"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="restock-supplier">Fournisseur (optionnel)</Label>
              <Input
                id="restock-supplier"
                className="h-11"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="Nom du fournisseur"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="restock-payment">Mode de paiement</Label>
              <Select
                id="restock-payment"
                aria-label="Mode de paiement"
                disallowEmptySelection
                selectedKeys={[paymentMethod]}
                onSelectionChange={(keys) =>
                  setPaymentMethod(
                    String(Array.from(keys)[0] ?? 'CASH') as PaymentMethod
                  )
                }
              >
                {PAYMENT_OPTIONS.map((p) => (
                  <SelectItem key={p.value}>{p.label}</SelectItem>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="restock-note">Note (optionnel)</Label>
              <Input
                id="restock-note"
                className="h-11"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Remarque"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-end sm:gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="restock-create-expense"
                checked={createExpense}
                disabled={expenseBlocked}
                onCheckedChange={setCreateExpense}
              />
              <Label
                htmlFor="restock-create-expense"
                className="cursor-pointer"
              >
                Créer une dépense liée
              </Label>
            </div>
            {expenseBlocked && (
              <p className="text-xs text-muted-foreground">
                Impossible tant que le total est nul : renseignez au moins un
                coût unitaire.
              </p>
            )}
            {createExpense && !expenseBlocked && (
              <div className="min-w-0 flex-1 space-y-1.5">
                <Label htmlFor="restock-expense-cat">
                  Catégorie de dépense
                </Label>
                <Select
                  id="restock-expense-cat"
                  aria-label="Catégorie de dépense"
                  placeholder="Choisir une catégorie"
                  selectedKeys={expenseCategoryId ? [expenseCategoryId] : []}
                  onSelectionChange={(keys) =>
                    setExpenseCategoryId(String(Array.from(keys)[0] ?? ''))
                  }
                >
                  {expenseCategories.map((c) => (
                    <SelectItem key={c.id}>{c.name}</SelectItem>
                  ))}
                </Select>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
