'use client';

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
} from 'react';
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

/** Référentiel d'articles pour l'autocomplétion des lignes de détail. */
export type ArticleOption = {
  id: string;
  name: string;
  baseUnit: string | null;
  trackInventory: boolean;
  /** Prix unitaire moyen pondéré connu (aide à la saisie) — pas garanti être
   * EXACTEMENT le dernier achat, cf. `getExpenseArticleStats`. */
  lastUnitPrice: number | null;
};

/** Ligne de détail en cours de saisie (chaînes brutes des inputs). */
export type ExpenseItemFormValues = {
  /** Article rattaché (autocomplétion) — null = texte libre (auto-création). */
  articleId: string | null;
  rawLabel: string;
  label: string;
  formatQty: string;
  formatSize: string;
  unit: string;
  unitPrice: string;
  amount: string;
  pendingQuantity: boolean;
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

const DEBOUNCE_MS = 150;
const MIN_QUERY_LENGTH = 2;
const MAX_SUGGESTIONS = 5;

export function emptyExpenseItem(): ExpenseItemFormValues {
  return {
    articleId: null,
    rawLabel: '',
    label: '',
    formatQty: '',
    formatSize: '',
    unit: '',
    unitPrice: '',
    amount: '',
    pendingQuantity: false,
  };
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
    return s + (Number.isFinite(n) && n >= 0 ? Math.round(n) : 0);
  }, 0);
}

/**
 * Champ « article » d'une ligne de détail : saisie libre + autocomplétion
 * (debounce ~150 ms, min 2 caractères, top 5 résultats). L'option « garder en
 * texte libre » reste toujours visible dans la liste — même sans résultat —
 * pour permettre l'auto-création d'un nouvel article sans friction.
 */
function ArticleField({
  value,
  articles,
  onChangeText,
  onPick,
}: {
  value: string;
  articles: ArticleOption[];
  onChangeText: (text: string) => void;
  onPick: (article: ArticleOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<ArticleOption[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (blurTimer.current) clearTimeout(blurTimer.current);
    };
  }, []);

  function runSearch(term: string) {
    const q = term.trim().toLowerCase();
    if (q.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const hits = articles
      .filter((a) => a.name.toLowerCase().includes(q))
      .slice(0, MAX_SUGGESTIONS);
    setSuggestions(hits);
    setActiveIndex(-1);
    // Toujours ouvert dès 2 caractères : l'option « garder en texte libre »
    // doit rester accessible même sans correspondance.
    setOpen(true);
  }

  function handleChange(text: string) {
    onChangeText(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => runSearch(text), DEBOUNCE_MS);
  }

  function handlePick(article: ArticleOption) {
    if (timer.current) clearTimeout(timer.current);
    onPick(article);
    setSuggestions([]);
    setOpen(false);
    setActiveIndex(-1);
  }

  function keepFreeText() {
    setOpen(false);
  }

  const freeTextIndex = suggestions.length;
  const totalOptions = suggestions.length + 1;

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % totalOptions);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? totalOptions - 1 : i - 1));
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        e.preventDefault();
        handlePick(suggestions[activeIndex]);
      } else if (activeIndex === freeTextIndex) {
        e.preventDefault();
        keepFreeText();
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <Input
        aria-label="Article"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (value.trim().length >= MIN_QUERY_LENGTH) runSearch(value);
        }}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setOpen(false), 120);
        }}
        placeholder="Article (ex. Farine T45)"
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      {open && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-card py-1 text-sm shadow-md"
        >
          {suggestions.map((a, i) => (
            <li key={a.id} role="option" aria-selected={i === activeIndex}>
              <button
                type="button"
                // onMouseDown : se déclenche avant le blur de l'input.
                onMouseDown={(e) => {
                  e.preventDefault();
                  handlePick(a);
                }}
                onMouseEnter={() => setActiveIndex(i)}
                className={cn(
                  'flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left',
                  i === activeIndex && 'bg-accent'
                )}
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  {a.trackInventory && <span aria-hidden>📦</span>}
                  <span className="truncate">{a.name}</span>
                </span>
                {a.lastUnitPrice != null && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {priceFmt.format(a.lastUnitPrice)} F
                  </span>
                )}
              </button>
            </li>
          ))}
          <li role="option" aria-selected={activeIndex === freeTextIndex}>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                keepFreeText();
              }}
              onMouseEnter={() => setActiveIndex(freeTextIndex)}
              className={cn(
                'flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-muted-foreground',
                activeIndex === freeTextIndex && 'bg-accent'
              )}
            >
              <Plus className="h-3.5 w-3.5" />
              Garder « {value.trim() || '…'} » en texte libre
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}

export function ExpenseForm({
  categories,
  articles,
  mode,
  initial,
  onSuccess,
}: {
  categories: Category[];
  /** Référentiel pour l'autocomplétion des lignes de détail. */
  articles: ArticleOption[];
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
        // Ergonomie : le montant de ligne suit qté × format × prix unitaire
        // dès que qté et PU sont saisis (reste éditable à la main ensuite).
        if (
          ('formatQty' in patch ||
            'formatSize' in patch ||
            'unitPrice' in patch) &&
          next.formatQty &&
          next.unitPrice
        ) {
          const q = Number(next.formatQty);
          const size = next.formatSize ? Number(next.formatSize) : 1;
          const p = Number(next.unitPrice);
          if (
            Number.isFinite(q) &&
            Number.isFinite(size) &&
            Number.isFinite(p) &&
            q > 0 &&
            p >= 0
          ) {
            next.amount = String(Math.round(q * size * p));
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
          articleId?: string;
          articleName?: string;
          rawLabel: string;
          label: string | null;
          formatQty: number | null;
          formatSize: number | null;
          unit: string | null;
          unitPrice: number | null;
          amount: number;
          pendingQuantity?: boolean;
        }[]
      | null
      | undefined;

    if (detailed) {
      for (const item of values.items) {
        if (!item.rawLabel.trim()) {
          setError('Chaque ligne doit avoir un libellé (ex. « Farine T45 »)');
          return;
        }
        const a = Number(item.amount);
        if (!Number.isFinite(a) || a < 0) {
          setError(
            `Ligne « ${item.rawLabel.trim()} » : montant invalide (saisis une quantité × prix unitaire, ou un montant direct)`
          );
          return;
        }
      }
      itemsPayload = values.items.map((item) => {
        const rawLabel = item.rawLabel.trim();
        return {
          articleId: item.articleId ?? undefined,
          articleName: item.articleId ? undefined : rawLabel || undefined,
          rawLabel,
          label: item.label.trim() || null,
          formatQty: item.formatQty ? Number(item.formatQty) : null,
          formatSize: item.formatSize ? Number(item.formatSize) : null,
          unit: item.unit.trim() || null,
          unitPrice: item.unitPrice ? Math.round(Number(item.unitPrice)) : null,
          amount: Math.round(Number(item.amount) || 0),
          pendingQuantity: item.pendingQuantity || undefined,
        };
      });
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
          <div className="space-y-3">
            {values.items.map((item, i) => (
              <div key={i} className="space-y-2 rounded-md border p-2">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1 space-y-2">
                    <ArticleField
                      value={item.rawLabel}
                      articles={articles}
                      onChangeText={(text) =>
                        setItem(i, { rawLabel: text, articleId: null })
                      }
                      onPick={(a) =>
                        setItem(i, {
                          rawLabel: a.name,
                          articleId: a.id,
                          unit: item.unit || a.baseUnit || '',
                        })
                      }
                    />
                    <Input
                      aria-label="Précision"
                      value={item.label}
                      onChange={(e) => setItem(i, { label: e.target.value })}
                      placeholder="Précision (optionnel, ex. bio, marque…)"
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
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <Input
                    aria-label="Quantité"
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    value={item.formatQty}
                    onChange={(e) => setItem(i, { formatQty: e.target.value })}
                    placeholder="Qté"
                  />
                  <Input
                    aria-label="Taille du format"
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    value={item.formatSize}
                    onChange={(e) => setItem(i, { formatSize: e.target.value })}
                    placeholder="Format (ex. 25 = sac de 25 kg)"
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
                    min={0}
                    inputMode="numeric"
                    value={item.amount}
                    onChange={(e) => setItem(i, { amount: e.target.value })}
                    placeholder="Montant"
                  />
                </div>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={item.pendingQuantity}
                    onChange={(e) =>
                      setItem(i, { pendingQuantity: e.target.checked })
                    }
                  />
                  Quantité à renseigner plus tard (montant connu)
                </label>
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
