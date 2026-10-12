'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ExpenseFormState } from './use-expense-form';
import type { Category } from './types';

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Espèces' },
  { value: 'WAVE', label: 'Wave' },
  { value: 'BANK', label: 'Banque / Virement' },
  { value: 'OTHER', label: 'Autre' },
] as const;

const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';

export function ExpenseFieldsSection({
  form,
  categories,
}: {
  form: ExpenseFormState;
  categories: Category[];
}) {
  const { values, set, detailed, total } = form;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="exp-date">Date</Label>
        <Input
          id="exp-date"
          type="date"
          value={values.date}
          onChange={(e) => set('date', e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="exp-amount">
          Montant (FCFA){detailed && ' — somme des lignes'}
        </Label>
        <Input
          id="exp-amount"
          type="number"
          min={1}
          inputMode="numeric"
          value={detailed ? String(total || '') : values.amount}
          onChange={(e) => set('amount', e.target.value)}
          placeholder="0"
          disabled={detailed}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="exp-cat">Catégorie</Label>
        <select
          id="exp-cat"
          className={selectClass}
          value={values.categoryId}
          onChange={(e) => set('categoryId', e.target.value)}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="exp-pay">Paiement</Label>
        <select
          id="exp-pay"
          className={selectClass}
          value={values.paymentMethod}
          onChange={(e) => set('paymentMethod', e.target.value)}
        >
          {PAYMENT_METHODS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="exp-supplier">Fournisseur (optionnel)</Label>
        <Input
          id="exp-supplier"
          value={values.supplier}
          onChange={(e) => set('supplier', e.target.value)}
          placeholder="Ex. Boulangerie du coin"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="exp-note">Note (optionnel)</Label>
        <Input
          id="exp-note"
          value={values.note}
          onChange={(e) => set('note', e.target.value)}
          placeholder="Détail…"
        />
      </div>
    </div>
  );
}
