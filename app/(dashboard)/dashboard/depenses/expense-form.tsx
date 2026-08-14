'use client';

// Formulaire de saisie d'une dépense, hébergé par une PAGE (pas un Sheet) :
// `depenses/nouvelle` et `depenses/[expenseId]`. Le détail par article n'est
// plus replié derrière un bouton — c'est le cas d'usage principal, il est
// visible d'emblée.
//
// La logique de calcul et de validation des lignes vit dans
// `lib/expense-item-draft.ts` (pure et testée) : ce composant ne fait
// qu'orchestrer l'état et la navigation.

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MediaImage as Image } from '@/components/ui/media-image';
import { Loader2, Paperclip, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { todayDateString } from '@/lib/timezone';
import { uploadToCloudinary } from '@/lib/cloudinary-client';
import { EXPENSE_ITEMS_MAX } from '@/config/constants';
import {
  applyDraftPatch,
  draftFromArticle,
  draftsToItemsInput,
  draftsTotal,
  emptyExpenseItemDraft,
  isQuantityPending,
  type ExpenseItemDraft,
} from '@/lib/expense-item-draft';
import type { ExpenseItemInput } from '@/lib/schemas/expense';
import type { ExpenseArticleOption } from '@/lib/expense-article-search';
import {
  ArticleCombobox,
  type ArticlePick,
} from './_components/article-combobox';
import { ExpenseItemRow } from './_components/expense-item-row';
import { createExpenseAction, updateExpenseAction } from './actions';

type Category = { id: string; name: string };

/** Référentiel d'articles pour la saisie — type canonique, source unique. */
export type ArticleOption = ExpenseArticleOption;

/** Ligne de détail en cours de saisie. */
export type ExpenseItemFormValues = ExpenseItemDraft;

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

export function ExpenseForm({
  categories,
  articles,
  mode,
  initial,
  cancelHref = '/dashboard/depenses',
}: {
  categories: Category[];
  /** Référentiel pour le choix d'article. */
  articles: ArticleOption[];
  mode: 'create' | 'edit';
  initial: ExpenseFormValues;
  /** Destination du bouton Annuler et du retour après succès. */
  cancelHref?: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState<ExpenseFormValues>(initial);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  // En édition, retirer toutes les lignes doit envoyer `items: null`
  // (dé-itemisation explicite côté serveur).
  const initialHadItems = useRef(initial.items.length > 0);
  // Ligne fraîchement ajoutée : on lui donne le focus sur la quantité, le seul
  // champ qu'il reste à saisir.
  const [lastAddedIndex, setLastAddedIndex] = useState<number | null>(null);

  const detailed = values.items.length > 0;
  const total = draftsTotal(values.items);
  const usedArticleIds = new Set(
    values.items
      .map((item) => item.articleId)
      .filter((id): id is string => id != null)
  );
  const atItemsLimit = values.items.length >= EXPENSE_ITEMS_MAX;

  function set<K extends keyof ExpenseFormValues>(
    key: K,
    value: ExpenseFormValues[K]
  ) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function setItem(index: number, patch: Partial<ExpenseItemDraft>) {
    setValues((v) => ({
      ...v,
      items: v.items.map((item, i) =>
        i === index ? applyDraftPatch(item, patch) : item
      ),
    }));
  }

  function draftFromPick(pick: ArticlePick): ExpenseItemDraft {
    return pick.kind === 'existing'
      ? draftFromArticle(pick.article)
      : { ...emptyExpenseItemDraft(), rawLabel: pick.name };
  }

  function addFromPick(pick: ArticlePick) {
    if (atItemsLimit) {
      setError(`Trop de lignes : ${EXPENSE_ITEMS_MAX} au maximum.`);
      return;
    }
    setError(null);
    // Index calculé hors de l'updater : un `setState` niché s'y rejouerait en
    // StrictMode.
    setLastAddedIndex(values.items.length);
    setValues((v) => ({ ...v, items: [...v.items, draftFromPick(pick)] }));
  }

  /** Remplacement de l'article d'une ligne : patch NON destructif — on n'écrase
   *  ni l'unité ni le prix déjà saisis à la main. */
  function replaceArticle(index: number, pick: ArticlePick) {
    setValues((v) => ({
      ...v,
      items: v.items.map((item, i) => {
        if (i !== index) return item;
        const fresh = draftFromPick(pick);
        return applyDraftPatch(item, {
          articleId: fresh.articleId,
          rawLabel: fresh.rawLabel,
          unit: item.unit || fresh.unit,
          ...(item.unitPrice.trim().length === 0
            ? {
                unitPrice: fresh.unitPrice,
                unitPriceIsSuggestion: fresh.unitPriceIsSuggestion,
              }
            : {}),
        });
      }),
    }));
  }

  function removeItem(index: number) {
    setLastAddedIndex(null);
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
    // `undefined` = ne pas toucher au détail · `null` = le retirer ·
    // tableau = remplacement complet (sémantique de `updateExpense`).
    let items: ExpenseItemInput[] | null | undefined;

    if (detailed) {
      // À la création, une ligne dont le montant est connu sans quantité est
      // marquée « quantité à compléter ». Pas en édition : une ligne historique
      // sans quantité basculerait au simple ré-enregistrement.
      const drafts =
        mode === 'create'
          ? values.items.map((item) => ({
              ...item,
              pendingQuantity: item.pendingQuantity || isQuantityPending(item),
            }))
          : values.items;

      const validation = draftsToItemsInput(drafts);
      if (!validation.ok) {
        setError(validation.error);
        return;
      }
      items = validation.items;
      amountInt = validation.total;
    } else {
      amountInt = Math.round(Number(values.amount));
      if (!Number.isFinite(amountInt) || amountInt <= 0) {
        setError('Montant invalide');
        return;
      }
      // Dé-itemisation explicite : la dépense avait un détail, il a été retiré.
      items = mode === 'edit' && initialHadItems.current ? null : undefined;
    }

    const payload = {
      date: values.date,
      amount: amountInt,
      categoryId: values.categoryId,
      paymentMethod: values.paymentMethod,
      supplier: values.supplier.trim() || null,
      note: values.note.trim() || null,
      receiptUrl: values.receiptUrl,
      ...(items !== undefined ? { items } : {}),
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
      router.push(cancelHref);
      router.refresh();
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
    <div className="max-w-3xl space-y-4 pb-24">
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

      {/* Détail par article : visible d'emblée, c'est le cas d'usage principal. */}
      <div className="space-y-3 rounded-lg border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">Articles</p>
          {detailed && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setLastAddedIndex(null);
                set('items', []);
              }}
            >
              <X className="mr-1 h-4 w-4" />
              Saisir un montant global sans détail
            </Button>
          )}
        </div>

        {articles.length === 0 && !detailed ? (
          <p className="text-sm text-muted-foreground">
            Aucun article enregistré pour l’instant — tape un nom pour créer le
            premier.
          </p>
        ) : null}

        <ArticleCombobox
          articles={articles}
          onPick={addFromPick}
          usedArticleIds={usedArticleIds}
        />

        {atItemsLimit && (
          <p className="text-xs text-muted-foreground">
            Limite de {EXPENSE_ITEMS_MAX} lignes atteinte.
          </p>
        )}

        {detailed && (
          <div className="space-y-3">
            {values.items.map((item, i) => (
              <ExpenseItemRow
                key={i}
                item={item}
                index={i}
                articles={articles}
                usedArticleIds={usedArticleIds}
                autoFocusQuantity={i === lastAddedIndex}
                onPatch={(patch) => setItem(i, patch)}
                onReplaceArticle={(pick) => replaceArticle(i, pick)}
                onRemove={() => removeItem(i)}
              />
            ))}
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

      {/* Barre collante : le total et l'action restent toujours accessibles. */}
      <div className="sticky bottom-0 -mx-4 border-t bg-background px-4 py-3 sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {detailed
              ? `${values.items.length} article${values.items.length > 1 ? 's' : ''} · `
              : ''}
            Total{' '}
            <span className="font-semibold tabular-nums text-foreground">
              {priceFmt.format(detailed ? total : Number(values.amount) || 0)} F
            </span>
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => router.push(cancelHref)}
            >
              Annuler
            </Button>
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
        </div>
      </div>
    </div>
  );
}
