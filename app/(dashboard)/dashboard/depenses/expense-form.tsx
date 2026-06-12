'use client';

import { useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import { Loader2, Paperclip, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { todayDateString } from '@/lib/timezone';
import { createExpenseAction, updateExpenseAction } from './actions';

type Category = { id: string; name: string };

export type ExpenseFormValues = {
  id?: string;
  date: string;
  amount: string;
  categoryId: string;
  paymentMethod: string;
  supplier: string;
  note: string;
  receiptUrl: string | null;
};

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Espèces' },
  { value: 'WAVE', label: 'Wave' },
  { value: 'BANK', label: 'Banque / Virement' },
  { value: 'OTHER', label: 'Autre' },
] as const;

const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';

/** Valeurs par défaut d'une nouvelle dépense (formulaire vierge). */
export function emptyExpense(categories: Category[]): ExpenseFormValues {
  return {
    date: todayDateString(),
    amount: '',
    categoryId: categories[0]?.id ?? '',
    paymentMethod: 'CASH',
    supplier: '',
    note: '',
    receiptUrl: null,
  };
}

export function ExpenseForm({
  categories,
  mode,
  initial,
  onSuccess,
}: {
  categories: Category[];
  mode: 'create' | 'edit';
  initial: ExpenseFormValues;
  /** Appelé après une écriture réussie (fermeture du Sheet par le parent). */
  onSuccess: () => void;
}) {
  const [values, setValues] = useState<ExpenseFormValues>(initial);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function set<K extends keyof ExpenseFormValues>(
    key: K,
    value: ExpenseFormValues[K]
  ) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function onPickFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload/receipt', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Échec de l’upload');
      set('receiptUrl', data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de l’upload');
    } finally {
      setUploading(false);
    }
  }

  function submit() {
    setError(null);
    const amountInt = Number(values.amount);
    if (!Number.isFinite(amountInt) || amountInt <= 0) {
      setError('Montant invalide');
      return;
    }
    if (!values.categoryId) {
      setError('Choisis une catégorie');
      return;
    }

    const payload = {
      date: values.date,
      amount: Math.round(amountInt),
      categoryId: values.categoryId,
      paymentMethod: values.paymentMethod,
      supplier: values.supplier.trim() || null,
      note: values.note.trim() || null,
      receiptUrl: values.receiptUrl,
    };

    startTransition(async () => {
      const result =
        mode === 'edit' && values.id
          ? await updateExpenseAction(values.id, payload)
          : await createExpenseAction(payload);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSuccess();
    });
  }

  const busy = pending || uploading;

  if (categories.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Crée d’abord une catégorie pour pouvoir saisir une dépense.
      </p>
    );
  }

  return (
    <div className="space-y-4">
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
          <Label htmlFor="exp-amount">Montant (FCFA)</Label>
          <Input
            id="exp-amount"
            type="number"
            min={1}
            inputMode="numeric"
            value={values.amount}
            onChange={(e) => set('amount', e.target.value)}
            placeholder="0"
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

      {/* Justificatif */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPickFile(f);
          }}
        />
        {values.receiptUrl ? (
          <div className="flex items-center gap-2">
            <Image
              src={values.receiptUrl}
              alt="Justificatif"
              width={40}
              height={40}
              className="size-10 rounded-md object-cover"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => set('receiptUrl', null)}
            >
              <X className="mr-1 h-4 w-4" /> Retirer
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Paperclip className="mr-1.5 h-4 w-4" />
            )}
            Justificatif (photo)
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        onClick={submit}
        disabled={busy}
        className={cn(busy && 'opacity-70')}
      >
        {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
        {mode === 'edit'
          ? 'Enregistrer les modifications'
          : 'Enregistrer la dépense'}
      </Button>
    </div>
  );
}
