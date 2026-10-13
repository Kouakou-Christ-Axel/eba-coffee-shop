'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { InvestmentFormState } from './use-investment-form';

export function RepaymentSection({ form }: { form: InvestmentFormState }) {
  const { values, set } = form;
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label htmlFor="inv-reimbursable">À rembourser</Label>
          <p className="text-xs text-muted-foreground">
            Active pour un prêt ou une avance à restituer.
          </p>
        </div>
        <Switch
          id="inv-reimbursable"
          checked={values.reimbursable}
          onCheckedChange={(c) => set('reimbursable', c)}
        />
      </div>
      {values.reimbursable && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="inv-repaid">Déjà remboursé (FCFA)</Label>
            <Input
              id="inv-repaid"
              type="number"
              min={0}
              inputMode="numeric"
              value={values.amountRepaid}
              onChange={(e) => set('amountRepaid', e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-due">Échéance (optionnel)</Label>
            <Input
              id="inv-due"
              type="date"
              value={values.dueDate}
              onChange={(e) => set('dueDate', e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
