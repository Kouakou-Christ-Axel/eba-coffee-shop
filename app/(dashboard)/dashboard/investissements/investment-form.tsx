'use client';

import { useRef, useState, useTransition } from 'react';
import { MediaImage as Image } from '@/components/ui/media-image';
import { Loader2, Paperclip, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { todayDateString } from '@/lib/timezone';
import { uploadToCloudinary } from '@/lib/cloudinary-client';
import { createInvestmentAction, updateInvestmentAction } from './actions';

type Source = { id: string; name: string };

export type InvestmentFormValues = {
  id?: string;
  date: string;
  amount: string;
  sourceId: string;
  paymentMethod: string;
  financier: string;
  note: string;
  documentUrl: string | null;
  reimbursable: boolean;
  amountRepaid: string;
  dueDate: string;
};

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Espèces' },
  { value: 'WAVE', label: 'Wave' },
  { value: 'BANK', label: 'Banque / Virement' },
  { value: 'OTHER', label: 'Autre' },
] as const;

const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';

/** Valeurs par défaut d'un nouvel apport (formulaire vierge). */
export function emptyInvestment(sources: Source[]): InvestmentFormValues {
  return {
    date: todayDateString(),
    amount: '',
    sourceId: sources[0]?.id ?? '',
    paymentMethod: 'CASH',
    financier: '',
    note: '',
    documentUrl: null,
    reimbursable: false,
    amountRepaid: '',
    dueDate: '',
  };
}

export function InvestmentForm({
  sources,
  mode,
  initial,
  onSuccess,
}: {
  sources: Source[];
  mode: 'create' | 'edit';
  initial: InvestmentFormValues;
  /** Appelé après une écriture réussie (fermeture du Sheet par le parent). */
  onSuccess: () => void;
}) {
  const [values, setValues] = useState<InvestmentFormValues>(initial);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function set<K extends keyof InvestmentFormValues>(
    key: K,
    value: InvestmentFormValues[K]
  ) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function onPickFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const url = await uploadToCloudinary(file, '/api/upload/receipt/sign');
      set('documentUrl', url);
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
    if (!values.sourceId) {
      setError('Choisis une source');
      return;
    }
    const repaidInt = values.reimbursable
      ? Number(values.amountRepaid || 0)
      : 0;
    if (values.reimbursable && repaidInt > amountInt) {
      setError('Le montant remboursé dépasse le montant de l’apport');
      return;
    }

    const payload = {
      date: values.date,
      amount: Math.round(amountInt),
      sourceId: values.sourceId,
      paymentMethod: values.paymentMethod,
      financier: values.financier.trim() || null,
      note: values.note.trim() || null,
      documentUrl: values.documentUrl,
      reimbursable: values.reimbursable,
      amountRepaid: values.reimbursable ? Math.round(repaidInt) : 0,
      dueDate: values.reimbursable && values.dueDate ? values.dueDate : null,
    };

    startTransition(async () => {
      const result =
        mode === 'edit' && values.id
          ? await updateInvestmentAction(values.id, payload)
          : await createInvestmentAction(payload);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSuccess();
    });
  }

  const busy = pending || uploading;

  if (sources.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Crée d’abord une source de financement pour pouvoir saisir un apport.
      </p>
    );
  }

  return (
    <div className="space-y-4">
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

      {/* Suivi de remboursement */}
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
        {values.documentUrl ? (
          <div className="flex items-center gap-2">
            <Image
              src={values.documentUrl}
              alt="Justificatif"
              width={40}
              height={40}
              className="size-10 rounded-md object-cover"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => set('documentUrl', null)}
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
          : 'Enregistrer l’apport'}
      </Button>
    </div>
  );
}
