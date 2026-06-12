'use client';

import { useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import { Loader2, Paperclip, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { todayDateString } from '@/lib/timezone';
import { createExpenseAction } from './actions';

type Category = { id: string; name: string };

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Espèces' },
  { value: 'WAVE', label: 'Wave' },
  { value: 'BANK', label: 'Banque / Virement' },
  { value: 'OTHER', label: 'Autre' },
] as const;

const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';

export function ExpenseForm({ categories }: { categories: Category[] }) {
  const [date, setDate] = useState(todayDateString());
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [supplier, setSupplier] = useState('');
  const [note, setNote] = useState('');
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

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
      setReceiptUrl(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de l’upload');
    } finally {
      setUploading(false);
    }
  }

  function submit() {
    setError(null);
    const amountInt = Number(amount);
    if (!Number.isFinite(amountInt) || amountInt <= 0) {
      setError('Montant invalide');
      return;
    }
    if (!categoryId) {
      setError('Choisis une catégorie');
      return;
    }
    startTransition(async () => {
      const result = await createExpenseAction({
        date,
        amount: Math.round(amountInt),
        categoryId,
        paymentMethod,
        supplier: supplier.trim() || null,
        note: note.trim() || null,
        receiptUrl,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Reset (on garde la date et la catégorie pour des saisies en série).
      setAmount('');
      setSupplier('');
      setNote('');
      setReceiptUrl(null);
      if (fileRef.current) fileRef.current.value = '';
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="exp-date">Date</Label>
          <Input
            id="exp-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="exp-amount">Montant (FCFA)</Label>
          <Input
            id="exp-amount"
            type="number"
            min={1}
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="exp-cat">Catégorie</Label>
          <select
            id="exp-cat"
            className={selectClass}
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
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
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
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
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            placeholder="Ex. Boulangerie du coin"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="exp-note">Note (optionnel)</Label>
          <Input
            id="exp-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
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
        {receiptUrl ? (
          <div className="flex items-center gap-2">
            <Image
              src={receiptUrl}
              alt="Justificatif"
              width={40}
              height={40}
              className="size-10 rounded-md object-cover"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setReceiptUrl(null)}
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
        Enregistrer la dépense
      </Button>
    </div>
  );
}
