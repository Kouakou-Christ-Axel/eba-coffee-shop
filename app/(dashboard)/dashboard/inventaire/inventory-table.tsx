'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Archive,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
} from 'lucide-react';
import { Select, SelectItem } from '@heroui/react';
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
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { InventoryItemView } from '@/lib/inventory';
import {
  archiveInventoryItemAction,
  createInventoryItemAction,
  updateInventoryItemAction,
} from './actions';
import {
  ItemForm,
  emptyItem,
  itemFromView,
  type ItemFormValues,
} from './item-form';

const f = new Intl.NumberFormat('fr-FR');
const PAGE_SIZE = 25;

/** '' → undefined, sinon valeur trimée. */
function strOrUndef(s: string): string | undefined {
  const t = s.trim();
  return t === '' ? undefined : t;
}

/** '' → undefined, sinon Number. */
function numOrUndef(s: string): number | undefined {
  const t = s.trim();
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

export function InventoryTable({
  items,
  categories,
}: {
  items: InventoryItemView[];
  categories: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [page, setPage] = useState(1);

  // Sheet de création.
  const [createOpen, setCreateOpen] = useState(false);
  const [createValues, setCreateValues] = useState<ItemFormValues>(emptyItem);

  // Sheet d'édition.
  const [editItem, setEditItem] = useState<InventoryItemView | null>(null);
  const [editValues, setEditValues] = useState<ItemFormValues>(emptyItem);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (categoryFilter !== 'all' && (it.category ?? '') !== categoryFilter) {
        return false;
      }
      if (!q) return true;
      return (
        it.name.toLowerCase().includes(q) || it.sku.toLowerCase().includes(q)
      );
    });
  }, [items, search, categoryFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(
    () =>
      filtered.slice(
        (currentPage - 1) * PAGE_SIZE,
        currentPage * PAGE_SIZE
      ),
    [filtered, currentPage]
  );

  function openCreate() {
    setError(null);
    setCreateValues(emptyItem);
    setCreateOpen(true);
  }

  function openEdit(item: InventoryItemView) {
    setError(null);
    setEditItem(item);
    setEditValues(itemFromView(item));
  }

  function submitCreate() {
    setError(null);
    const v = createValues;
    if (!v.name.trim()) {
      setError('Le nom est obligatoire.');
      return;
    }
    const input = {
      name: v.name.trim(),
      unit: v.unit,
      category: strOrUndef(v.category),
      safetyStock: numOrUndef(v.safetyStock),
      reorderPoint: numOrUndef(v.reorderPoint),
      supplier: strOrUndef(v.supplier),
      notes: strOrUndef(v.notes),
      initialQuantity: numOrUndef(v.initialQuantity),
      initialUnitCost: numOrUndef(v.initialUnitCost),
    };
    startTransition(async () => {
      const r = await createInventoryItemAction(input);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setCreateOpen(false);
      router.refresh();
    });
  }

  function submitEdit() {
    if (!editItem) return;
    setError(null);
    const v = editValues;
    if (!v.name.trim()) {
      setError('Le nom est obligatoire.');
      return;
    }
    const input = {
      name: v.name.trim(),
      unit: v.unit,
      category: strOrUndef(v.category) ?? null,
      safetyStock: numOrUndef(v.safetyStock),
      reorderPoint: numOrUndef(v.reorderPoint) ?? null,
      supplier: strOrUndef(v.supplier) ?? null,
      notes: strOrUndef(v.notes) ?? null,
    };
    const id = editItem.id;
    startTransition(async () => {
      const r = await updateInventoryItemAction(id, input);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setEditItem(null);
      router.refresh();
    });
  }

  function archive(item: InventoryItemView) {
    if (
      !window.confirm(
        `Archiver la référence « ${item.name} » ? Elle n’apparaîtra plus dans la liste.`
      )
    ) {
      return;
    }
    setError(null);
    setPendingId(item.id);
    startTransition(async () => {
      const r = await archiveInventoryItemAction(item.id);
      setPendingId(null);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Rechercher (nom, réf.)…"
          className="w-full sm:max-w-xs"
        />
        <Select
          aria-label="Filtrer par catégorie"
          size="sm"
          className="w-full sm:max-w-[200px]"
          selectedKeys={[categoryFilter]}
          disallowEmptySelection
          onSelectionChange={(keys) => {
            setCategoryFilter(String(Array.from(keys)[0] ?? 'all'));
            setPage(1);
          }}
        >
          <>
            <SelectItem key="all">Toutes les catégories</SelectItem>
            <>
              {categories.map((c) => (
                <SelectItem key={c}>{c}</SelectItem>
              ))}
            </>
          </>
        </Select>
        <div className="ml-auto">
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" />
            Nouvelle référence
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Réf.</TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>PMP</TableHead>
              <TableHead>Valeur</TableHead>
              <TableHead>Seuil</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map((it) => (
              <TableRow key={it.id}>
                <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                  {it.sku}
                </TableCell>
                <TableCell className="text-sm font-medium">{it.name}</TableCell>
                <TableCell>
                  {it.category ? (
                    <Badge variant="secondary">{it.category}</Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap tabular-nums">
                  {f.format(it.currentQuantity)} {it.unit}
                </TableCell>
                <TableCell className="tabular-nums">
                  {f.format(it.avgUnitCost)} F
                </TableCell>
                <TableCell className="tabular-nums">
                  {f.format(it.stockValue)} F
                </TableCell>
                <TableCell className="tabular-nums">
                  {f.format(it.safetyStock)}
                </TableCell>
                <TableCell>
                  {it.isLowStock ? (
                    <Badge variant="destructive">Bas</Badge>
                  ) : (
                    <Badge variant="secondary">OK</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => openEdit(it)}
                      aria-label="Modifier la référence"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => archive(it)}
                      disabled={pendingId === it.id}
                      aria-label="Archiver la référence"
                    >
                      {pendingId === it.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Archive className="h-4 w-4 text-destructive" />
                      )}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  Aucune référence.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {filtered.length > 0 && (
        <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
          <span className="tabular-nums">
            {filtered.length} référence{filtered.length > 1 ? 's' : ''}
            {totalPages > 1 && ` · page ${currentPage}/${totalPages}`}
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="outline"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                aria-label="Page précédente"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                aria-label="Page suivante"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Sheet de création */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Nouvelle référence</SheetTitle>
            <SheetDescription>
              Ajoute un article au stock (avec un stock d’ouverture optionnel).
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4">
            <ItemForm values={createValues} onChange={setCreateValues} isNew />
            {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
            <Button className="mt-4" onClick={submitCreate} disabled={pending}>
              {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Créer
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Sheet d'édition */}
      <Sheet
        open={editItem !== null}
        onOpenChange={(open) => {
          if (!open) setEditItem(null);
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Modifier la référence</SheetTitle>
            <SheetDescription>
              Mise à jour des informations de l’article.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4">
            <ItemForm
              values={editValues}
              onChange={setEditValues}
              isNew={false}
            />
            {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
            <Button className="mt-4" onClick={submitEdit} disabled={pending}>
              {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
