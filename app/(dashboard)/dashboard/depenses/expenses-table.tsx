'use client';

import { Fragment, useMemo, useState, useTransition } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Loader2,
  Pencil,
  Plus,
  Receipt,
  Settings2,
  Trash2,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { todayDateString } from '@/lib/timezone';
import { deleteExpenseAction } from './actions';
import {
  ExpenseForm,
  emptyExpense,
  type ArticleOption,
  type ExpenseFormValues,
} from './expense-form';
import { CategoryManager, type CategoryRow } from './category-manager';

type Category = { id: string; name: string };

export type ExpenseItemRow = {
  id: string;
  articleId: string | null;
  /** Nom de l'article rattaché ; null si la ligne n'a jamais été rapprochée. */
  articleName: string | null;
  rawLabel: string;
  label: string | null;
  formatQty: number | null;
  formatSize: number | null;
  unit: string | null;
  unitPrice: number | null;
  amount: number;
  pendingQuantity: boolean;
};

export type ExpenseRow = {
  id: string;
  receiptNo: string | null;
  date: string;
  amount: number;
  paymentLabel: string;
  paymentMethod: string;
  supplier: string | null;
  note: string | null;
  receiptUrl: string | null;
  categoryId: string;
  categoryName: string;
  items: ExpenseItemRow[];
};

const priceFmt = new Intl.NumberFormat('fr-FR');
const qtyFmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 });

function rowToValues(
  r: ExpenseRow,
  mode: 'edit' | 'duplicate'
): ExpenseFormValues {
  return {
    id: mode === 'edit' ? r.id : undefined,
    date: mode === 'duplicate' ? todayDateString() : r.date,
    amount: String(r.amount),
    categoryId: r.categoryId,
    paymentMethod: r.paymentMethod,
    supplier: r.supplier ?? '',
    note: r.note ?? '',
    receiptUrl: mode === 'duplicate' ? null : r.receiptUrl,
    // La duplication recopie aussi le détail : re-saisir le même panier du
    // marché = 2 clics.
    items: r.items.map((i) => ({
      articleId: i.articleId,
      rawLabel: i.rawLabel,
      label: i.label ?? '',
      formatQty: i.formatQty != null ? String(i.formatQty) : '',
      formatSize: i.formatSize != null ? String(i.formatSize) : '',
      unit: i.unit ?? '',
      unitPrice: i.unitPrice != null ? String(i.unitPrice) : '',
      amount: String(i.amount),
      pendingQuantity: i.pendingQuantity,
    })),
  };
}

export function ExpensesTable({
  expenses,
  categories,
  articles,
  total,
}: {
  expenses: ExpenseRow[];
  categories: CategoryRow[];
  articles: ArticleOption[];
  total: number;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  // Lignes dépliées (détail par article visible).
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Sheet de saisie (création / édition / duplication).
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [formInitial, setFormInitial] = useState<ExpenseFormValues>(() =>
    emptyExpense(categories)
  );
  // Sheet de gestion des catégories.
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  const plainCategories: Category[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
  }));

  // Sous-totaux par mode de paiement sur la sélection courante.
  const byPaymentMethod = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses) {
      map.set(e.paymentLabel, (map.get(e.paymentLabel) ?? 0) + e.amount);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openCreate() {
    setFormMode('create');
    setFormInitial(emptyExpense(categories));
    setFormOpen(true);
  }

  function openEdit(r: ExpenseRow) {
    setFormMode('edit');
    setFormInitial(rowToValues(r, 'edit'));
    setFormOpen(true);
  }

  function openDuplicate(r: ExpenseRow) {
    setFormMode('create');
    setFormInitial(rowToValues(r, 'duplicate'));
    setFormOpen(true);
  }

  function remove(id: string) {
    setError(null);
    setPendingId(id);
    startTransition(async () => {
      const r = await deleteExpenseAction(id);
      setPendingId(null);
      if (!r.ok) setError(r.error);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCategoriesOpen(true)}
        >
          <Settings2 className="mr-1.5 h-4 w-4" />
          Gérer les catégories
        </Button>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          Nouvelle dépense
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>N° reçu</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead>Montant</TableHead>
              <TableHead>Paiement</TableHead>
              <TableHead>Fournisseur</TableHead>
              <TableHead>Note</TableHead>
              <TableHead>Justif.</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.map((e) => (
              <Fragment key={e.id}>
                <TableRow>
                  <TableCell className="pr-0">
                    {e.items.length > 0 && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-6"
                        onClick={() => toggleExpanded(e.id)}
                        aria-label={
                          expanded.has(e.id)
                            ? 'Masquer le détail'
                            : 'Voir le détail'
                        }
                      >
                        {expanded.has(e.id) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                    {e.receiptNo ?? '—'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-sm">
                    {e.date}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="secondary">{e.categoryName}</Badge>
                      {e.items.length > 0 && (
                        <Badge
                          variant="outline"
                          className="cursor-pointer whitespace-nowrap"
                          onClick={() => toggleExpanded(e.id)}
                        >
                          {e.items.length} article
                          {e.items.length > 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {priceFmt.format(e.amount)} F
                  </TableCell>
                  <TableCell className="text-sm">{e.paymentLabel}</TableCell>
                  <TableCell className="text-sm">{e.supplier ?? '—'}</TableCell>
                  <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground">
                    {e.note ?? '—'}
                  </TableCell>
                  <TableCell>
                    {e.receiptUrl ? (
                      <a
                        href={e.receiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-primary hover:underline"
                        aria-label="Voir le justificatif"
                      >
                        <Receipt className="h-4 w-4" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openEdit(e)}
                        aria-label="Modifier la dépense"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openDuplicate(e)}
                        aria-label="Dupliquer la dépense"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => remove(e.id)}
                        disabled={pendingId === e.id}
                        aria-label="Supprimer la dépense"
                      >
                        {pendingId === e.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 text-destructive" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                {expanded.has(e.id) && e.items.length > 0 && (
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableCell />
                    <TableCell colSpan={9} className="py-2">
                      <ul className="space-y-1 text-sm">
                        {e.items.map((item) => (
                          <li
                            key={item.id}
                            className="flex flex-wrap items-baseline gap-x-2"
                          >
                            <span className="font-medium">
                              {item.articleName ?? item.rawLabel}
                            </span>
                            {item.label && (
                              <span className="text-muted-foreground">
                                {item.label}
                              </span>
                            )}
                            {item.pendingQuantity && (
                              <Badge variant="outline" className="text-[10px]">
                                qté à renseigner
                              </Badge>
                            )}
                            <span className="text-muted-foreground">
                              {item.formatQty != null
                                ? `${qtyFmt.format(item.formatQty)}${
                                    item.formatSize
                                      ? ` × ${qtyFmt.format(item.formatSize)}`
                                      : ''
                                  } ${item.unit ?? ''}`.trim()
                                : ''}
                              {item.formatQty != null &&
                                item.unitPrice != null &&
                                ` × ${priceFmt.format(item.unitPrice)} F`}
                            </span>
                            <span className="ml-auto font-medium tabular-nums">
                              {priceFmt.format(item.amount)} F
                            </span>
                          </li>
                        ))}
                      </ul>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))}
            {expenses.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={10}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  Aucune dépense sur cette sélection.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Sous-totaux par mode de paiement + total global. */}
      <div className="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {byPaymentMethod.map(([label, amount]) => (
            <span key={label}>
              {label} :{' '}
              <span className="font-medium tabular-nums text-foreground">
                {priceFmt.format(amount)} F
              </span>
            </span>
          ))}
        </div>
        <div className="flex justify-end gap-2 text-sm">
          <span className="text-muted-foreground">Total :</span>
          <span className="font-bold tabular-nums">
            {priceFmt.format(total)} F
          </span>
        </div>
      </div>

      {/* Sheet de saisie */}
      <Sheet open={formOpen} onOpenChange={setFormOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>
              {formMode === 'edit' ? 'Modifier la dépense' : 'Nouvelle dépense'}
            </SheetTitle>
            <SheetDescription>
              Dépense d’exploitation catégorisée — détaille les articles pour
              alimenter les statistiques de fréquence.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4">
            <ExpenseForm
              // Remonte le formulaire à chaque ouverture (reset des champs).
              key={`${formMode}-${formInitial.id ?? 'new'}-${formOpen}`}
              categories={plainCategories}
              articles={articles}
              mode={formMode}
              initial={formInitial}
              onSuccess={() => setFormOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Sheet de gestion des catégories */}
      <Sheet open={categoriesOpen} onOpenChange={setCategoriesOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Catégories</SheetTitle>
            <SheetDescription>
              Catégories de dépense et leur nature (fixe / variable).
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4">
            <CategoryManager categories={categories} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
