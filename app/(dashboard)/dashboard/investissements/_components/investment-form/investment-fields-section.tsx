'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Source } from './types';
import type { InvestmentFormState } from './use-investment-form';

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Espèces' },
  { value: 'WAVE', label: 'Wave' },
  { value: 'BANK', label: 'Banque / Virement' },
  { value: 'OTHER', label: 'Autre' },
] as const;

const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';

export function InvestmentFieldsSection({
  form,
  sources,
}: {
  form: InvestmentFormState;
  sources: Source[];
}) {
  const { values, set } = form;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="inv-date">Date</Label>
        <Input
          id="inv-date"
          type="date"
          value={values.date}
          onChange={(e) => set('date', e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="inv-amount">Montant (FCFA)</Label>
        <Input
          id="inv-amount"
          type="number"
          min={1}
          inputMode="numeric"
          value={values.amount}
          onChange={(e) => set('amount', e.target.value)}
          placeholder="0"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="inv-source">Source de financement</Label>
        <select
          id="inv-source"
          className={selectClass}
          value={values.sourceId}
          onChange={(e) => set('sourceId', e.target.value)}
        >
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="inv-pay">Canal</Label>
        <select
          id="inv-pay"
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
        <Label htmlFor="inv-financier">Financeur (optionnel)</Label>
        <Input
          id="inv-financier"
          value={values.financier}
          onChange={(e) => set('financier', e.target.value)}
          placeholder="Ex. Apport M. Kouassi, Banque Atlantique…"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="inv-note">Note (optionnel)</Label>
        <Input
          id="inv-note"
          value={values.note}
          onChange={(e) => set('note', e.target.value)}
          placeholder="Détail…"
        />
      </div>
    </div>
  );
}
