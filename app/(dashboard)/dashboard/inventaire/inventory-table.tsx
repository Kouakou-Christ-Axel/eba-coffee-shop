'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, ArchiveRestore, Loader2, Pencil, Plus } from 'lucide-react';
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
import { createFuzzyIndex } from '@/lib/fuzzy-search';
import { useConfirmDialog } from '../_components/use-confirm-dialog';
import {
  archiveInventoryItemAction,
  createInventoryItemAction,
  restoreInventoryItemAction,
  updateInventoryItemAction,
} from './actions';
import {
  ItemForm,
  emptyItem,
  itemFromView,
  type ItemFormValues,
} from './item-form';

const f = new Intl.NumberFormat('fr-FR');

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
  archived,
  categories,
}: {
  items: InventoryItemView[];
  archived: InventoryItemView[];
  categories: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const { confirm, confirmDialog } = useConfirmDialog();

  // Une erreur par surface. Un seul état partagé faisait apparaître l'échec
  // d'un archivage à la fois dans la barre d'outils ET dans les deux sheets
  // ouverts, chacun l'attribuant à sa propre action.
  const [listError, setListError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showArchived, setShowArchived] = useState(false);

  const visibleItems = showArchived ? archived : items;

  // Sheet de création.
  const [createOpen, setCreateOpen] = useState(false);
  const [createValues, setCreateValues] = useState<ItemFormValues>(emptyItem);

  // Sheet d'édition.
  const [editItem, setEditItem] = useState<InventoryItemView | null>(null);
  const [editValues, setEditValues] = useState<ItemFormValues>(emptyItem);

  // Recherche partagée plutôt qu'un `includes()` maison : celui-ci était
  // sensible aux accents (« cafe » ne trouvait pas « Café ») et à l'ordre des
  // mots. Indexation mémoïsée sur la référence du tableau, jamais à la frappe.
  const index = useMemo(
    () =>
      createFuzzyIndex(visibleItems, {
        keys: [
          { name: 'name' },
          { name: 'sku', weight: 0.5 },
          { name: 'category', weight: 0.3 },
        ],
      }),
    [visibleItems]
  );

  const filtered = useMemo(() => {
    const query = search.trim();
    const base =
      query === '' ? visibleItems : index.search(query).map((h) => h.item);
    return base.filter(
      (it) => categoryFilter === 'all' || (it.category ?? '') === categoryFilter
    );
  }, [visibleItems, index, search, categoryFilter]);

  function openCreate() {
    setFormError(null);
    setCreateValues(emptyItem);
    setCreateOpen(true);
  }

  function openEdit(item: InventoryItemView) {
    setFormError(null);
    setEditItem(item);
    setEditValues(itemFromView(item));
  }

  function submitCreate() {
    setFormError(null);
    const v = createValues;
    if (!v.name.trim()) {
      setFormError('Le nom est obligatoire.');
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
        setFormError(r.error);
        return;
      }
      setCreateOpen(false);
      router.refresh();
    });
  }

  function submitEdit() {
    if (!editItem) return;
    setFormError(null);
    const v = editValues;
    if (!v.name.trim()) {
      setFormError('Le nom est obligatoire.');
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
        setFormError(r.error);
        return;
      }
      setEditItem(null);
      router.refresh();
    });
  }

  async function archive(item: InventoryItemView) {
    const confirmed = await confirm({
      title: 'Archiver la référence',
      message: `« ${item.name} » n’apparaîtra plus dans la liste ni dans les comptages. Son historique est conservé et elle peut être restaurée.`,
      confirmLabel: 'Archiver',
      destructive: true,
    });
    if (!confirmed) return;
    setListError(null);
    setPendingId(item.id);
    startTransition(async () => {
      const r = await archiveInventoryItemAction(item.id);
      setPendingId(null);
      if (!r.ok) {
        setListError(r.error);
        return;
      }
      router.refresh();
    });
  }

  function restore(item: InventoryItemView) {
    setListError(null);
    setPendingId(item.id);
    startTransition(async () => {
      const r = await restoreInventoryItemAction(item.id);
      setPendingId(null);
      if (!r.ok) {
        setListError(r.error);
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
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher (nom, réf.)…"
          className="w-full sm:max-w-xs"
        />
        <Select
          aria-label="Filtrer par catégorie"
          size="sm"
          className="w-full sm:max-w-[200px]"
          selectedKeys={[categoryFilter]}
          disallowEmptySelection
          onSelectionChange={(keys) =>
            setCategoryFilter(String(Array.from(keys)[0] ?? 'all'))
          }
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
        {archived.length > 0 && (
          <Button
            size="sm"
            variant={showArchived ? 'secondary' : 'ghost'}
            onClick={() => setShowArchived((v) => !v)}
            aria-pressed={showArchived}
          >
            {showArchived
              ? 'Voir les actives'
              : `Archivées (${archived.length})`}
          </Button>
        )}
        <div className="ml-auto">
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" />
            Nouvelle référence
          </Button>
        </div>
      </div>

      {listError && (
        <p className="text-sm text-destructive" role="alert">
          {listError}
        </p>
      )}

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
            {filtered.map((it) => (
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
                      onClick={() => (it.active ? archive(it) : restore(it))}
                      disabled={pendingId === it.id}
                      aria-label={
                        it.active
                          ? 'Archiver la référence'
                          : 'Restaurer la référence'
                      }
                    >
                      {pendingId === it.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : it.active ? (
                        <Archive className="h-4 w-4 text-destructive" />
                      ) : (
                        <ArchiveRestore className="h-4 w-4" />
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
                  {showArchived
                    ? 'Aucune référence archivée.'
                    : 'Aucune référence.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

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
            <ItemForm
              values={createValues}
              onChange={setCreateValues}
              isNew
              categories={categories}
            />
            {formError && (
              <p className="mt-3 text-sm text-destructive" role="alert">
                {formError}
              </p>
            )}
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
              categories={categories}
            />
            {formError && (
              <p className="mt-3 text-sm text-destructive" role="alert">
                {formError}
              </p>
            )}
            <Button className="mt-4" onClick={submitEdit} disabled={pending}>
              {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {confirmDialog}
    </div>
  );
}
