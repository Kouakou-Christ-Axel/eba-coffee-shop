'use client';

import { useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { todayDateString } from '@/lib/timezone';
import {
  createRevenueAdjustmentAction,
  updateRevenueAdjustmentAction,
} from './actions';

export type RevenueAdjustmentFormValues = {
  id?: string;
  date: string;
  /** Sens : ajout (+) ou retrait (−) de CA. */
  direction: 'add' | 'remove';
  /** Montant positif saisi (le signe vient de `direction`). */
  amount: string;
  paymentMode: string;
  note: string;
};

const PAYMENT_MODES = [
  { value: 'CASH', label: 'Espèces' },
  { value: 'WAVE', label: 'Wave' },
  { value: 'ORANGE_MONEY', label: 'Orange Money' },
  { value: 'OTHER', label: 'Autre' },
] as const;

const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';

/** Valeurs par défaut d'une nouvelle régularisation (formulaire vierge). */
export function emptyAdjustment(): RevenueAdjustmentFormValues {
  return {
    date: todayDateString(),
    direction: 'add',
    amount: '',
    paymentMode: 'CASH',
    note: '',
  };
}

export function RevenueAdjustmentForm({
  mode,
  initial,
  onSuccess,
}: {
  mode: 'create' | 'edit';
  initial: RevenueAdjustmentFormValues;
  onSuccess: () => void;
}) {
  const [values, setValues] = useState<RevenueAdjustmentFormValues>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof RevenueAdjustmentFormValues>(
    key: K,
    value: RevenueAdjustmentFormValues[K]
  ) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function submit() {
    setError(null);
    const magnitude = Number(values.amount);
    if (!Number.isFinite(magnitude) || magnitude <= 0) {
      setError('Montant invalide');
      return;
    }
    const signed =
      values.direction === 'remove'
        ? -Math.round(magnitude)
        : Math.round(magnitude);

    const payload = {
      date: values.date,
      amount: signed,
      paymentMode: values.paymentMode,
      note: values.note.trim() || null,
    };

    startTransition(async () => {
      const result =
        mode === 'edit' && values.id
          ? await updateRevenueAdjustmentAction(values.id, payload)
          : await createRevenueAdjustmentAction(payload);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSuccess();
    });
  }

  return (
    <div className="space-y-4">
      {/* Sens de la régularisation */}
      <div className="space-y-1.5">
        <Label>Type</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={values.direction === 'add' ? 'default' : 'outline'}
            size="sm"
            className="flex-1"
            onClick={() => set('direction', 'add')}
          >
            Ajout de recette (+)
          </Button>
          <Button
            type="button"
            variant={values.direction === 'remove' ? 'default' : 'outline'}
            size="sm"
            className="flex-1"
            onClick={() => set('direction', 'remove')}
          >
            Retrait (−)
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="adj-date">Date</Label>
          <Input
            id="adj-date"
            type="date"
            value={values.date}
            onChange={(e) => set('date', e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="adj-amount">Montant (FCFA)</Label>
          <Input
            id="adj-amount"
            type="number"
            min={1}
            inputMode="numeric"
            value={values.amount}
            onChange={(e) => set('amount', e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="adj-pay">Mode de paiement</Label>
          <select
            id="adj-pay"
            className={selectClass}
            value={values.paymentMode}
            onChange={(e) => set('paymentMode', e.target.value)}
          >
            {PAYMENT_MODES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="adj-note">Motif (optionnel)</Label>
          <Input
            id="adj-note"
            value={values.note}
            onChange={(e) => set('note', e.target.value)}
            placeholder="Ex. Ventes mai non saisies"
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Une régularisation s’ajoute au CA des statistiques et de la clôture de
        caisse (mode espèces), sans créer de commande.
      </p>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        onClick={submit}
        disabled={pending}
        className={cn(pending && 'opacity-70')}
      >
        {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
        {mode === 'edit'
          ? 'Enregistrer les modifications'
          : 'Enregistrer la régularisation'}
      </Button>
    </div>
  );
}
