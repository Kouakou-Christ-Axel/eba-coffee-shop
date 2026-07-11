'use client';

import { useRef, useState, useTransition } from 'react';
import { MediaImage as Image } from '@/components/ui/media-image';
import { ListPlus, Loader2, Paperclip, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { todayDateString } from '@/lib/timezone';
import { uploadToCloudinary } from '@/lib/cloudinary-client';
import { createExpenseAction, updateExpenseAction } from './actions';

type Category = { id: string; name: string };
type Article = { id: string; name: string };

/** Ligne de détail en cours de saisie (chaînes brutes des inputs). */
export type ExpenseItemFormValues = {
  articleName: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  amount: string;
};

export type ExpenseFormValues = {
  id?: string;
  date: string;
  amount: string;
  categoryId: string;
  paymentMethod: string;
  supplier: string;
  note: string;
  receiptUrl: string | null;
  /** Lignes de détail (vide = dépense simple, sans détail). */
  items: ExpenseItemFormValues[];
};

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Espèces' },
  { value: 'WAVE', label: 'Wave' },
  { value: 'BANK', label: 'Banque / Virement' },
  { value: 'OTHER', label: 'Autre' },
] as const;

const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';

const priceFmt = new Intl.NumberFormat('fr-FR');

export function emptyExpenseItem(): ExpenseItemFormValues {
  return { articleName: '', quantity: '', unit: '', unitPrice: '', amount: '' };
}

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
    items: [],
  };
}

/** Somme des montants de lignes saisis (0 si non numérique). */
function itemsTotal(items: ExpenseItemFormValues[]): number {
  return items.reduce((s, i) => {
    const n = Number(i.amount);
    return s + (Number.isFinite(n) && n > 0 ? Math.round(n) : 0);
  }, 0);
}

export function ExpenseForm({
  categories,
  articles,
  mode,
  initial,
  onSuccess,
}: {
  categories: Category[];
  /** Référentiel pour l'autocomplétion des noms d'articles (datalist). */
  articles: Article[];
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
  // En édition, retirer toutes les lignes doit envoyer `items: null`
  // (dé-itemisation explicite côté serveur).
  const initialHadItems = useRef(initial.items.length > 0);

  const detailed = values.items.length > 0;
  const total = itemsTotal(values.items);

  function set<K extends keyof ExpenseFormValues>(
    key: K,
    value: ExpenseFormValues[K]
  ) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function setItem(index: number, patch: Partial<ExpenseItemFormValues>) {
    setValues((v) => {
      const items = v.items.map((item, i) => {
        if (i !== index) return item;
        const next = { ...item, ...patch };
        // Ergonomie : le montant de ligne suit quantité × prix unitaire dès
        // que les deux sont saisis (reste éditable à la main ensuite).
        if (
          ('quantity' in patch || 'unitPrice' in patch) &&
          next.quantity &&
          next.unitPrice
        ) {
          const q = Number(next.quantity);
          const p = Number(next.unitPrice);
          if (Number.isFinite(q) && Number.isFinite(p) && q > 0 && p > 0) {
            next.amount = String(Math.round(q * p));
          }
        }
        return next;
      });
      return { ...v, items };
    });
  }

  function addItem() {
    setValues((v) => ({ ...v, items: [...v.items, emptyExpenseItem()] }));
  }

  function removeItem(index: number) {
    setValues((v) => ({ ...v, items: v.items.filter((_, i) => i !== index) }));
  }

  async function onPickFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const url = await uploadToCloudinary(file, '/api/upload/receipt/sign');
      set('receiptUrl', url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de l’upload');
    } finally {
      setUploading(false);
    }
  }

  function submit() {
    setError(null);
    if (!values.categoryId) {
      setError('Choisis une catégorie');
      return;
    }

    let amountInt: number;
    let itemsPayload:
      | {
          articleName: string;
          quantity: number | null;
          unit: string | null;
          unitPrice: number | null;
          amount: number;
        }[]
      | null
      | undefined;

    if (detailed) {
      for (const item of values.items) {
        if (!item.articleName.trim()) {
          setError('Chaque ligne doit nommer son article (ex. « Farine T45 »)');
          return;
        }
        const a = Number(item.amount);
        if (!Number.isFinite(a) || a <= 0) {
          setError(
            `Ligne « ${item.articleName.trim()} » : montant invalide (saisis quantité × prix unitaire, ou un montant direct)`
          );
          return;
        }
      }
      itemsPayload = values.items.map((item) => ({
        articleName: item.articleName.trim(),
        quantity: item.quantity ? Number(item.quantity) : null,
        unit: item.unit.trim() || null,
        unitPrice: item.unitPrice ? Math.round(Number(item.unitPrice)) : null,
        amount: Math.round(Number(item.amount)),
      }));
      amountInt = total;
    } else {
      amountInt = Math.round(Number(values.amount));
      if (!Number.isFinite(amountInt) || amountInt <= 0) {
        setError('Montant invalide');
        return;
      }
      // Dé-itemisation explicite : la dépense avait un détail, il a été retiré.
      itemsPayload =
        mode === 'edit' && initialHadItems.current ? null : undefined;
    }

    const payload = {
      date: values.date,
      amount: amountInt,
      categoryId: values.categoryId,
      paymentMethod: values.paymentMethod,
      supplier: values.supplier.trim() || null,
      note: values.note.trim() || null,
      receiptUrl: values.receiptUrl,
      ...(itemsPayload !== undefined ? { items: itemsPayload } : {}),
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

      {/* Détail par article (optionnel) : alimente les stats de fréquence. */}
      {detailed ? (
        <div className="space-y-2 rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Détail des articles</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => set('items', [])}
            >
              <X className="mr-1 h-4 w-4" />
              Retirer le détail
            </Button>
          </div>
          <datalist id="exp-articles">
            {articles.map((a) => (
              <option key={a.id} value={a.name} />
            ))}
          </datalist>
          <div className="space-y-2">
            {values.items.map((item, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_auto] items-end gap-2"
              >
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
                  <Input
                    aria-label="Article"
                    list="exp-articles"
                    value={item.articleName}
                    onChange={(e) =>
                      setItem(i, { articleName: e.target.value })
                    }
                    placeholder="Article (ex. Farine T45)"
                    className="col-span-2 sm:col-span-1"
                  />
                  <Input
                    aria-label="Quantité"
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    value={item.quantity}
                    onChange={(e) => setItem(i, { quantity: e.target.value })}
                    placeholder="Qté"
                  />
                  <Input
                    aria-label="Unité"
                    value={item.unit}
                    onChange={(e) => setItem(i, { unit: e.target.value })}
                    placeholder="kg, sac…"
                  />
                  <Input
                    aria-label="Prix unitaire (FCFA)"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={item.unitPrice}
                    onChange={(e) => setItem(i, { unitPrice: e.target.value })}
                    placeholder="PU (F)"
                  />
                  <Input
                    aria-label="Montant (FCFA)"
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={item.amount}
                    onChange={(e) => setItem(i, { amount: e.target.value })}
                    placeholder="Montant"
                  />
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => removeItem(i)}
                  aria-label="Retirer la ligne"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between pt-1">
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              <Plus className="mr-1 h-4 w-4" />
              Ajouter une ligne
            </Button>
            <p className="text-sm text-muted-foreground">
              Total des lignes :{' '}
              <span className="font-semibold tabular-nums text-foreground">
                {priceFmt.format(total)} F
              </span>
            </p>
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={addItem}>
          <ListPlus className="mr-1.5 h-4 w-4" />
          Détailler les articles
        </Button>
      )}

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
