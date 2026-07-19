'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Archive,
  Check,
  ChevronsUpDown,
  History,
  Loader2,
  Merge,
  Pencil,
  Plus,
  Search,
  Settings2,
  X,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { BASE_UNITS, BASE_UNIT_TO_INVENTORY } from '@/lib/expense-units';
import type { BaseUnit } from '@/lib/expense-units';
import type { InventoryUnitInput } from '@/lib/schemas/inventory';
import {
  renameExpenseArticleAction,
  archiveExpenseArticleAction,
  setExpenseArticleSettingsAction,
  mergeArticlesAction,
  createInventoryReferenceAction,
} from './actions';

export type ArticleStatRow = {
  articleId: string;
  name: string;
  baseUnit: string | null;
  purchaseCount: number;
  totalAmount: number;
  totalQtyBase: number | null;
  avgUnitPrice: number | null;
  lastPurchaseDate: string | null;
  avgIntervalDays: number | null;
  monthlyAvgCount: number;
  monthlyAvgQtyBase: number | null;
};

/** Métadonnées complètes d'un article actif (référentiel), pour les actions
 * d'administration (réglages, fusion) — indépendant des filtres de période. */
export type ArticleMeta = {
  id: string;
  name: string;
  baseUnit: string | null;
  trackInventory: boolean;
  inventoryItemId: string | null;
  location: string | null;
  wholesaleRefPrice: number | null;
  /** Nombre total de lignes de dépense rattachées (toutes périodes) — sert de
   * prévisualisation avant fusion (« N lignes seront rattachées à… »). */
  itemsCount: number;
};

/** Référence d'inventaire disponible pour le sélecteur de liaison stock. */
export type InventoryItemOption = {
  id: string;
  name: string;
  sku: string;
  unit: string;
};

const priceFmt = new Intl.NumberFormat('fr-FR');
const qtyFmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 });
const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';

/**
 * Fréquence d'achat par article sur la sélection courante : répond à
 * « combien de fois a-t-on acheté la farine T45 ? ». Recherche instantanée
 * côté client ; l'icône historique ouvre le drill-down (`?article=`). Les
 * actions d'administration (réglages, fusion, archivage) opèrent sur le
 * référentiel complet (`articlesMeta`), indépendamment des filtres de période.
 */
export function ArticlesTable({
  stats,
  articlesMeta,
  inventoryItems,
}: {
  stats: ArticleStatRow[];
  articlesMeta: ArticleMeta[];
  inventoryItems: InventoryItemOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [mergeId, setMergeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const metaById = useMemo(
    () => new Map(articlesMeta.map((a) => [a.id, a])),
    [articlesMeta]
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stats;
    return stats.filter((s) => s.name.toLowerCase().includes(q));
  }, [stats, query]);

  function openHistory(articleId: string) {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set('article', articleId);
    router.replace(`?${sp.toString()}`, { scroll: false });
  }

  function saveRename(id: string) {
    const name = editName.trim();
    if (!name) return;
    setError(null);
    startTransition(async () => {
      const r = await renameExpenseArticleAction(id, { name });
      if (!r.ok) setError(r.error);
      else {
        setEditingId(null);
        router.refresh();
      }
    });
  }

  function archive(id: string, name: string) {
    if (!window.confirm(`Retirer « ${name} » du référentiel d'articles ?`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await archiveExpenseArticleAction(id);
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un article (ex. farine)"
          className="pl-8"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Article</TableHead>
              <TableHead className="text-right">Achats</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Qté totale</TableHead>
              <TableHead className="text-right">Qté / mois</TableHead>
              <TableHead className="text-right">PU moyen</TableHead>
              <TableHead>Dernier achat</TableHead>
              <TableHead className="text-right">Intervalle moyen</TableHead>
              <TableHead className="text-right">Cadence / mois</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((s) => (
              <TableRow key={s.articleId}>
                <TableCell className="font-medium">
                  {editingId === s.articleId ? (
                    <div className="flex items-center gap-1.5">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === 'Enter' && saveRename(s.articleId)
                        }
                        className="h-8 max-w-[200px]"
                        autoFocus
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        onClick={() => saveRename(s.articleId)}
                        disabled={pending}
                        aria-label="Valider"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        onClick={() => setEditingId(null)}
                        aria-label="Annuler"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      {s.name}
                      {metaById.get(s.articleId)?.trackInventory && (
                        <span aria-hidden title="Suivi de stock">
                          📦
                        </span>
                      )}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {s.purchaseCount}×
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {priceFmt.format(s.totalAmount)} F
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {s.totalQtyBase != null
                    ? `${qtyFmt.format(s.totalQtyBase)} ${s.baseUnit ?? ''}`.trim()
                    : '—'}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {s.monthlyAvgQtyBase != null
                    ? `${qtyFmt.format(s.monthlyAvgQtyBase)} ${s.baseUnit ?? ''}`.trim()
                    : '—'}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {s.avgUnitPrice != null
                    ? `${priceFmt.format(s.avgUnitPrice)} F${
                        s.baseUnit ? `/${s.baseUnit}` : ''
                      }`
                    : '—'}
                </TableCell>
                <TableCell className="whitespace-nowrap font-mono text-sm">
                  {s.lastPurchaseDate ?? '—'}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {s.avgIntervalDays != null ? `${s.avgIntervalDays} j` : '—'}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {s.monthlyAvgCount}×
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => openHistory(s.articleId)}
                      aria-label={`Historique de « ${s.name} »`}
                    >
                      <History className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setEditingId(s.articleId);
                        setEditName(s.name);
                      }}
                      aria-label="Renommer l'article"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setSettingsId(s.articleId)}
                      disabled={!metaById.has(s.articleId)}
                      aria-label="Réglages de l'article"
                    >
                      <Settings2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setMergeId(s.articleId)}
                      disabled={!metaById.has(s.articleId)}
                      aria-label="Fusionner avec un autre article"
                    >
                      <Merge className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => archive(s.articleId, s.name)}
                      disabled={pending}
                      aria-label="Retirer l'article du référentiel"
                    >
                      {pending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Archive className="h-4 w-4 text-destructive" />
                      )}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={10}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  {stats.length === 0
                    ? 'Aucune dépense détaillée sur cette sélection — détaille les articles à la saisie pour alimenter ces statistiques.'
                    : 'Aucun article ne correspond à la recherche.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {settingsId && metaById.has(settingsId) && (
        <ArticleSettingsSheet
          article={metaById.get(settingsId)!}
          inventoryItems={inventoryItems}
          linkedElsewhere={
            new Set(
              articlesMeta
                .filter((a) => a.id !== settingsId && a.inventoryItemId)
                .map((a) => a.inventoryItemId!)
            )
          }
          onClose={() => setSettingsId(null)}
        />
      )}

      {mergeId && metaById.has(mergeId) && (
        <ArticleMergeSheet
          source={metaById.get(mergeId)!}
          targets={articlesMeta.filter((a) => a.id !== mergeId)}
          onClose={() => setMergeId(null)}
        />
      )}
    </div>
  );
}

/** Réglages d'un article : unité de base, suivi de stock, emplacement, prix
 * de référence en gros. */
function ArticleSettingsSheet({
  article,
  inventoryItems,
  linkedElsewhere,
  onClose,
}: {
  article: ArticleMeta;
  inventoryItems: InventoryItemOption[];
  linkedElsewhere: Set<string>;
  onClose: () => void;
}) {
  const router = useRouter();
  const [baseUnit, setBaseUnit] = useState(article.baseUnit ?? '');
  const [trackInventory, setTrackInventory] = useState(article.trackInventory);
  const [inventoryItemId, setInventoryItemId] = useState(
    article.inventoryItemId ?? ''
  );
  // Référentiel d'inventaire local : les références créées à la volée
  // (« ajouter directement ») s'ajoutent ici pour être proposées aussitôt.
  const [items, setItems] = useState(inventoryItems);
  const [location, setLocation] = useState(article.location ?? '');
  const [wholesaleRefPrice, setWholesaleRefPrice] = useState(
    article.wholesaleRefPrice != null ? String(article.wholesaleRefPrice) : ''
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectableItems = items.filter(
    (i) => !linkedElsewhere.has(i.id) || i.id === article.inventoryItemId
  );

  function save() {
    setError(null);
    const price = wholesaleRefPrice.trim()
      ? Math.round(Number(wholesaleRefPrice))
      : null;
    if (wholesaleRefPrice.trim() && (!Number.isFinite(price) || price! < 0)) {
      setError('Prix de référence invalide');
      return;
    }
    startTransition(async () => {
      const r = await setExpenseArticleSettingsAction(article.id, {
        baseUnit: baseUnit || null,
        trackInventory,
        inventoryItemId: trackInventory ? inventoryItemId || null : null,
        location: location.trim() || null,
        wholesaleRefPrice: price,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Réglages — {article.name}</SheetTitle>
          <SheetDescription>
            Unité de base, suivi de stock et emplacement de l’article.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-4">
          <div className="space-y-1.5">
            <Label htmlFor="art-unit">Unité de base</Label>
            <select
              id="art-unit"
              className={selectClass}
              value={baseUnit}
              onChange={(e) => setBaseUnit(e.target.value)}
            >
              <option value="">—</option>
              {BASE_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Suivi de stock</p>
              <p className="text-xs text-muted-foreground">
                Article rattaché à une référence d’inventaire.
              </p>
            </div>
            <Switch
              checked={trackInventory}
              onCheckedChange={setTrackInventory}
              aria-label="Suivi de stock"
            />
          </div>
          {trackInventory && (
            <div className="space-y-1.5">
              <Label htmlFor="art-inventory-item">Référence d’inventaire</Label>
              <InventoryRefCombobox
                items={selectableItems}
                value={inventoryItemId}
                onChange={setInventoryItemId}
                baseUnit={baseUnit || null}
                onCreated={(item) => {
                  setItems((prev) => [...prev, item]);
                  setInventoryItemId(item.id);
                }}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="art-location">Emplacement (optionnel)</Label>
            <Input
              id="art-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ex. Réserve, cuisine…"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="art-price">
              Prix de référence en gros (FCFA, optionnel)
            </Label>
            <Input
              id="art-price"
              type="number"
              min={0}
              inputMode="numeric"
              value={wholesaleRefPrice}
              onChange={(e) => setWholesaleRefPrice(e.target.value)}
              placeholder="0"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={save} disabled={pending}>
            {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Enregistrer
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Sélecteur de référence d'inventaire recherchable, avec création à la volée.
 * Auto-suffisant (pas d'overlay portalé) pour rester utilisable dans le Sheet
 * Radix — le piège de focus des Dialog casse les popovers portalés. Quand la
 * recherche ne correspond à aucune référence existante, propose de la créer
 * directement (`createInventoryReferenceAction`), en pré-remplissant son unité
 * depuis l'unité de base de l'article.
 */
function InventoryRefCombobox({
  items,
  value,
  onChange,
  onCreated,
  baseUnit,
}: {
  items: InventoryItemOption[];
  value: string;
  onChange: (id: string) => void;
  onCreated: (item: InventoryItemOption) => void;
  baseUnit: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = items.find((i) => i.id === value) ?? null;
  const q = query.trim().toLowerCase();
  const filtered = q
    ? items.filter(
        (i) =>
          i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q)
      )
    : items;
  const canCreate =
    q.length > 0 && !items.some((i) => i.name.trim().toLowerCase() === q);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  function pick(id: string) {
    onChange(id);
    setQuery('');
    setOpen(false);
    setError(null);
  }

  async function create() {
    const name = query.trim();
    if (!name || creating) return;
    setError(null);
    setCreating(true);
    const invUnit =
      baseUnit && baseUnit in BASE_UNIT_TO_INVENTORY
        ? (BASE_UNIT_TO_INVENTORY[baseUnit as BaseUnit] as InventoryUnitInput)
        : undefined;
    const r = await createInventoryReferenceAction({ name, unit: invUnit });
    setCreating(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    onCreated(r.item);
    setQuery('');
    setOpen(false);
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          selectClass,
          'flex items-center justify-between gap-2 text-left'
        )}
      >
        <span className={cn('truncate', !selected && 'text-muted-foreground')}>
          {selected
            ? `${selected.name} (${selected.sku}, ${selected.unit})`
            : '— Aucune —'}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
          <div className="relative mb-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher une référence…"
              className="h-8 pl-8"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            <button
              type="button"
              onClick={() => pick('')}
              className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
            >
              <span className="text-muted-foreground">— Aucune —</span>
              {!value && <Check className="h-4 w-4" />}
            </button>
            {filtered.map((i) => (
              <button
                key={i.id}
                type="button"
                onClick={() => pick(i.id)}
                className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
              >
                <span className="truncate">
                  {i.name}{' '}
                  <span className="text-muted-foreground">
                    ({i.sku}, {i.unit})
                  </span>
                </span>
                {value === i.id && <Check className="h-4 w-4 shrink-0" />}
              </button>
            ))}
            {filtered.length === 0 && !canCreate && (
              <p className="px-2 py-1.5 text-sm text-muted-foreground">
                Aucune référence.
              </p>
            )}
          </div>
          {canCreate && (
            <button
              type="button"
              onClick={create}
              disabled={creating}
              className="mt-1 flex w-full items-center gap-1.5 rounded-sm border-t px-2 py-1.5 text-left text-sm hover:bg-accent"
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Créer la référence « {query.trim()} »
            </button>
          )}
          {error && (
            <p className="px-2 py-1.5 text-xs text-destructive">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}

/** Fusion de deux articles en double : prévisualise le nombre de lignes qui
 * seront rattachées à la cible avant confirmation. */
function ArticleMergeSheet({
  source,
  targets,
  onClose,
}: {
  source: ArticleMeta;
  targets: ArticleMeta[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [targetId, setTargetId] = useState(targets[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const target = targets.find((t) => t.id === targetId);

  function confirm() {
    if (!targetId) return;
    setError(null);
    startTransition(async () => {
      const r = await mergeArticlesAction(source.id, targetId);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Fusionner « {source.name} »</SheetTitle>
          <SheetDescription>
            Dédoublonnage : toutes les lignes de dépense de « {source.name} »
            seront rattachées à l’article choisi, qui remplace « {source.name}»
            (archivé, jamais supprimé).
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-4">
          {targets.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun autre article actif vers lequel fusionner.
            </p>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="merge-target">Fusionner vers</Label>
                <select
                  id="merge-target"
                  className={selectClass}
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                >
                  {targets.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              {target && (
                <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                  {source.itemsCount} ligne{source.itemsCount > 1 ? 's' : ''}{' '}
                  seront rattachée{source.itemsCount > 1 ? 's' : ''} à «{' '}
                  {target.name} ».
                </p>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button onClick={confirm} disabled={pending || !targetId}>
                {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                Confirmer la fusion
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
