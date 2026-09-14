'use client';

// Saisie d'un réapprovisionnement.
//
// Elle se faisait ligne par ligne depuis un `Select` HeroUI non cherchable posé
// sur 117 références : ouvrir, faire défiler, choisir, taper la quantité, taper
// le coût — quatre à six gestes par article, sans enchaînement au clavier, et
// sans aucun moyen de retrouver une référence autrement qu'à l'œil.
//
// Trois changements :
//
//   1. Un combobox unique en tête. Il liste tout au focus (le manquant
//      d'abord), filtre en tolérant accents et fautes de frappe, et garde le
//      focus après un choix — on enchaîne sans repasser à la souris.
//   2. « Ajouter les N sous le seuil » : le vrai remède au volume, un appui
//      pour toute la liste de réassort, quantités suggérées.
//   3. Le coût unitaire n'est plus prérempli avec `avgUnitCost`. Le PMP vaut 0
//      partout tant qu'aucun achat chiffré n'a été saisi, et un 0 prérempli est
//      pire que rien : il passe la validation et empoisonne le PMP en se
//      faisant passer pour un prix décidé. On propose le dernier prix payé,
//      affiché COMME une suggestion, et la saisie manuelle l'emporte.

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Select, SelectItem } from '@heroui/react';
import { AlertCircle, ChevronDown, PackagePlus, Trash2 } from 'lucide-react';

import type { InventoryItemView } from '@/lib/inventory';
import { todayDateString } from '@/lib/timezone';
import {
  suggestRestockQuantity,
  type InventoryItemOption,
} from '@/lib/inventory-item-search';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';

import { batchRestockAction } from '../actions';
import { InventoryItemCombobox } from '../_components/inventory-item-combobox';

const f = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 });

type PaymentMethod = 'CASH' | 'WAVE' | 'BANK' | 'OTHER';

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'CASH', label: 'Espèces' },
  { value: 'WAVE', label: 'Wave' },
  { value: 'BANK', label: 'Banque' },
  { value: 'OTHER', label: 'Autre' },
];

const dayFmt = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
});

function formatDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return dayFmt.format(new Date(Date.UTC(y, m - 1, d)));
}

type Line = {
  itemId: string;
  quantity: string;
  unitCost: string;
  /** Le coût vient d'un achat passé, pas d'une décision. Toute saisie l'efface. */
  costIsSuggestion: boolean;
};

export type LastCost = { unitCost: number; date: string };

export function RestockView({
  items,
  expenseCategories,
  lastCosts,
  prefillLowStock,
}: {
  items: InventoryItemView[];
  expenseCategories: { id: string; name: string }[];
  lastCosts: Record<string, LastCost>;
  prefillLowStock: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [date, setDate] = useState(todayDateString());
  const [supplier, setSupplier] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [note, setNote] = useState('');
  const [createExpense, setCreateExpense] = useState(false);
  const [expenseCategoryId, setExpenseCategoryId] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const itemMap = useMemo(
    () => new Map(items.map((it) => [it.id, it])),
    [items]
  );
  const lowStockItems = useMemo(
    () => items.filter((it) => it.isLowStock),
    [items]
  );

  function newLine(item: InventoryItemView): Line {
    const last = lastCosts[item.id];
    const suggested = suggestRestockQuantity(item);
    return {
      itemId: item.id,
      quantity: suggested === null ? '' : String(suggested),
      unitCost: last ? String(last.unitCost) : '',
      costIsSuggestion: Boolean(last),
    };
  }

  const [lines, setLines] = useState<Line[]>(() =>
    prefillLowStock ? items.filter((it) => it.isLowStock).map(newLine) : []
  );

  const quantityRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [lastAdded, setLastAdded] = useState<number | null>(
    prefillLowStock && lowStockItems.length > 0 ? 0 : null
  );

  const options: InventoryItemOption[] = useMemo(
    () =>
      items.map((it) => ({
        id: it.id,
        sku: it.sku,
        name: it.name,
        category: it.category,
        unit: it.unit,
        currentQuantity: it.currentQuantity,
        safetyStock: it.safetyStock,
        reorderPoint: it.reorderPoint,
        isLowStock: it.isLowStock,
      })),
    [items]
  );
  const usedItemIds = useMemo(
    () => new Set(lines.map((l) => l.itemId)),
    [lines]
  );

  const subtotal = (l: Line) => Number(l.quantity) * Number(l.unitCost || 0);
  const grandTotal = lines.reduce((sum, l) => {
    const s = subtotal(l);
    return sum + (Number.isFinite(s) ? s : 0);
  }, 0);

  const unknownCostCount = lines.filter(
    (l) => Number(l.unitCost || 0) <= 0
  ).length;

  function addItem(option: InventoryItemOption) {
    const item = itemMap.get(option.id);
    if (!item) return;
    setError(null);
    setLines((prev) => {
      if (prev.some((l) => l.itemId === item.id)) return prev;
      setLastAdded(prev.length);
      return [...prev, newLine(item)];
    });
  }

  function addAllLowStock() {
    setError(null);
    setLines((prev) => {
      const seen = new Set(prev.map((l) => l.itemId));
      const added = lowStockItems.filter((it) => !seen.has(it.id)).map(newLine);
      if (added.length > 0) setLastAdded(prev.length);
      return [...prev, ...added];
    });
  }

  function updateLine(itemId: string, patch: Partial<Line>) {
    setLines((prev) =>
      prev.map((l) => (l.itemId === itemId ? { ...l, ...patch } : l))
    );
  }

  function removeLine(itemId: string) {
    setLines((prev) => prev.filter((l) => l.itemId !== itemId));
  }

  function focusNextQuantity(index: number) {
    for (let i = index + 1; i < quantityRefs.current.length; i++) {
      const el = quantityRefs.current[i];
      if (el) {
        el.focus();
        el.select();
        return;
      }
    }
  }

  const invalidLine = (l: Line) => {
    const q = Number(l.quantity);
    return l.quantity.trim() === '' || !Number.isFinite(q) || q <= 0;
  };
  const hasInvalidLine = lines.some(invalidLine);
  const missingCategory = createExpense && !expenseCategoryId;
  // Une dépense liée à un total nul est refusée par le serveur : on le dit
  // avant l'aller-retour, plutôt qu'après.
  const expenseBlocked = grandTotal <= 0;
  const canSubmit =
    lines.length > 0 && !hasInvalidLine && !missingCategory && !pending;

  function handleSubmit() {
    if (!canSubmit) return;
    setError(null);
    startTransition(async () => {
      const res = await batchRestockAction({
        date,
        supplier: supplier.trim() || undefined,
        note: note.trim() || undefined,
        createExpense: createExpense && !expenseBlocked,
        expenseCategoryId:
          createExpense && !expenseBlocked ? expenseCategoryId : undefined,
        paymentMethod,
        lines: lines.map((l) => ({
          itemId: l.itemId,
          quantity: Number(l.quantity),
          unitCost: Number(l.unitCost || 0),
        })),
      });
      if (res.ok) {
        router.push('/dashboard/inventaire');
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Aucune référence d&apos;inventaire. Créez d&apos;abord des articles
          pour enregistrer un réappro.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 pb-28">
      {/* Réglages du lot. Repliés par défaut : la date du jour, les espèces et
          pas de fournisseur couvrent la quasi-totalité des réceptions, et ces
          quatre champs empilés occupaient tout le premier écran du téléphone
          avant la moindre référence. */}
      <Card className="p-3">
        <button
          type="button"
          onClick={() => setDetailsOpen((v) => !v)}
          aria-expanded={detailsOpen}
          className="flex min-h-11 w-full items-center justify-between gap-3 text-left"
        >
          <span className="min-w-0 truncate text-sm">
            <span className="font-medium">{formatDay(date)}</span>
            <span className="text-muted-foreground">
              {' · '}
              {PAYMENT_OPTIONS.find((p) => p.value === paymentMethod)?.label}
              {supplier.trim() ? ` · ${supplier.trim()}` : ''}
              {createExpense ? ' · dépense liée' : ''}
            </span>
          </span>
          <ChevronDown
            className={cn(
              'size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none',
              detailsOpen && 'rotate-180'
            )}
          />
        </button>

        {detailsOpen && (
          <div className="mt-3 space-y-3 border-t pt-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor="restock-date">Date</Label>
                <Input
                  id="restock-date"
                  type="date"
                  className="h-11"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="restock-supplier">
                  Fournisseur (optionnel)
                </Label>
                <Input
                  id="restock-supplier"
                  className="h-11"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  placeholder="Nom du fournisseur"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="restock-payment">Mode de paiement</Label>
                <Select
                  id="restock-payment"
                  aria-label="Mode de paiement"
                  disallowEmptySelection
                  selectedKeys={[paymentMethod]}
                  onSelectionChange={(keys) =>
                    setPaymentMethod(
                      String(Array.from(keys)[0] ?? 'CASH') as PaymentMethod
                    )
                  }
                >
                  {PAYMENT_OPTIONS.map((p) => (
                    <SelectItem key={p.value}>{p.label}</SelectItem>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="restock-note">Note (optionnel)</Label>
                <Input
                  id="restock-note"
                  className="h-11"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Remarque"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-end sm:gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  id="restock-create-expense"
                  checked={createExpense}
                  disabled={expenseBlocked}
                  onCheckedChange={setCreateExpense}
                />
                <Label
                  htmlFor="restock-create-expense"
                  className="cursor-pointer"
                >
                  Créer une dépense liée
                </Label>
              </div>
              {expenseBlocked && (
                <p className="text-xs text-muted-foreground">
                  Impossible tant que le total est nul : renseignez au moins un
                  coût unitaire.
                </p>
              )}
              {createExpense && !expenseBlocked && (
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Label htmlFor="restock-expense-cat">
                    Catégorie de dépense
                  </Label>
                  <Select
                    id="restock-expense-cat"
                    aria-label="Catégorie de dépense"
                    placeholder="Choisir une catégorie"
                    selectedKeys={expenseCategoryId ? [expenseCategoryId] : []}
                    onSelectionChange={(keys) =>
                      setExpenseCategoryId(String(Array.from(keys)[0] ?? ''))
                    }
                  >
                    {expenseCategories.map((c) => (
                      <SelectItem key={c.id}>{c.name}</SelectItem>
                    ))}
                  </Select>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      <div className="space-y-2">
        <InventoryItemCombobox
          items={options}
          onPick={addItem}
          usedItemIds={usedItemIds}
        />

        {lowStockItems.length > 0 && (
          <button
            type="button"
            onClick={addAllLowStock}
            className="inline-flex h-11 items-center gap-2 rounded-md border px-3.5 text-sm font-medium transition-colors hover:bg-muted"
          >
            <PackagePlus className="size-4" />
            Ajouter les {lowStockItems.length} sous le seuil
          </button>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {lines.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Cherchez une référence ci-dessus pour commencer le réappro.
        </p>
      ) : (
        <div className="space-y-2">
          {lines.map((line, i) => {
            const item = itemMap.get(line.itemId);
            if (!item) return null;
            const last = lastCosts[line.itemId];
            const s = subtotal(line);

            return (
              <div key={line.itemId} className="rounded-xl border bg-card p-3">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-medium">
                      {item.name}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      <span className="font-mono">{item.sku}</span>
                      <span aria-hidden> · </span>
                      Stock {f.format(item.currentQuantity)} {item.unit}
                      {item.isLowStock && (
                        <span className="ml-1.5 text-destructive">
                          sous le seuil
                        </span>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLine(line.itemId)}
                    aria-label={`Retirer ${item.name}`}
                    className="flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <div className="space-y-1">
                    <label
                      htmlFor={`qty-${line.itemId}`}
                      className="text-xs text-muted-foreground"
                    >
                      Quantité reçue
                    </label>
                    <Input
                      id={`qty-${line.itemId}`}
                      ref={(el) => {
                        quantityRefs.current[i] = el;
                      }}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="any"
                      className="h-11 tabular-nums"
                      autoFocus={i === lastAdded}
                      value={line.quantity}
                      onFocus={(e) => e.currentTarget.select()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          focusNextQuantity(i);
                        }
                      }}
                      onChange={(e) =>
                        updateLine(line.itemId, { quantity: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor={`cost-${line.itemId}`}
                      className="text-xs text-muted-foreground"
                    >
                      Coût unitaire (F)
                    </label>
                    <Input
                      id={`cost-${line.itemId}`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step="any"
                      className={cn(
                        'h-11 tabular-nums',
                        line.costIsSuggestion && 'text-muted-foreground'
                      )}
                      placeholder="—"
                      value={line.unitCost}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) =>
                        updateLine(line.itemId, {
                          unitCost: e.target.value,
                          // Une saisie manuelle l'emporte définitivement.
                          costIsSuggestion: false,
                        })
                      }
                    />
                  </div>

                  <div className="col-span-2 flex items-end justify-between gap-2 sm:col-span-1 sm:justify-end">
                    {line.costIsSuggestion && last && (
                      <span className="text-xs text-muted-foreground">
                        dernier achat du {last.date}
                      </span>
                    )}
                    <span className="text-base font-semibold tabular-nums">
                      {f.format(Number.isFinite(s) ? Math.round(s) : 0)} F
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg backdrop-blur">
        {unknownCostCount > 0 && lines.length > 0 && (
          <p className="mb-2 text-center text-xs text-muted-foreground">
            Coût inconnu sur {unknownCostCount} ligne
            {unknownCostCount > 1 ? 's' : ''} — le réappro reste enregistrable.
          </p>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="flex h-12 w-full items-center justify-between rounded-md bg-primary px-4 font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          <span>
            {pending ? 'Enregistrement…' : 'Valider le réappro'}
            {lines.length > 0 && ` · ${lines.length}`}
          </span>
          <span className="tabular-nums">
            {f.format(Math.round(grandTotal))} F
          </span>
        </button>
        {missingCategory && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Choisissez une catégorie de dépense.
          </p>
        )}
      </div>
    </div>
  );
}
