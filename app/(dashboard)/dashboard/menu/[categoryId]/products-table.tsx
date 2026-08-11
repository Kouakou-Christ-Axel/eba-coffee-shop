'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { MediaImage as Image } from '@/components/ui/media-image';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ProductRowActions } from './product-row-actions';
import { StockBadge } from '@/components/(dashboard)/stock-badge';
import { moveProductAction } from '../actions';
import {
  isPausedNow,
  isWithinAnyPeriod,
  nextUpcomingPeriod,
} from '@/lib/supplements';
import { formatAbidjanDateTime, formatAbidjanShortDate } from '@/lib/timezone';
import { LOW_STOCK_THRESHOLD } from '@/config/constants';

export type ProductRow = {
  id: string;
  name: string;
  price: number;
  coutMatiere: number;
  coutEmballage: number;
  imageUrl: string | null;
  available: boolean;
  featured: boolean;
  featuredBadge: string | null;
  stockQuantity: number | null;
  unavailableUntil: Date | null;
  scheduleName: string | null;
  weeklySpecialPeriods: { startDate: string; endDate: string }[];
  /** Quantité déjà demandée par des commandes NON payées (lecture seule). */
  pending?: number;
};

const priceFmt = new Intl.NumberFormat('fr-FR');
type Availability = 'all' | 'visible' | 'hidden';
type StockFilter = 'all' | 'low';
type SortKey = 'menu' | 'name' | 'price-desc' | 'margin-asc' | 'stock-asc';

const SORT_LABELS: Record<SortKey, string> = {
  menu: 'Ordre du menu',
  name: 'Nom (A→Z)',
  'price-desc': 'Prix (décroissant)',
  'margin-asc': 'Marge (croissante)',
  'stock-asc': 'Stock (croissant)',
};

/** Marge en pourcentage du prix ; `null` quand elle n'est pas calculable. */
function marginPct(p: ProductRow): number | null {
  const couts = p.coutMatiere + p.coutEmballage;
  if (couts <= 0 || p.price <= 0) return null;
  return Math.round(((p.price - couts) / p.price) * 100);
}

/** Stock nul ou sous le seuil d'alerte — `null` (illimité) n'alerte jamais. */
function isLowStock(p: ProductRow): boolean {
  return p.stockQuantity !== null && p.stockQuantity <= LOW_STOCK_THRESHOLD;
}

export function ProductsTable({
  categoryId,
  products,
}: {
  categoryId: string;
  products: ProductRow[];
}) {
  const [query, setQuery] = useState('');
  const [availability, setAvailability] = useState<Availability>('all');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>('menu');
  const [isMoving, startMove] = useTransition();

  const isFiltered =
    query.trim().length > 0 ||
    availability !== 'all' ||
    stockFilter !== 'all' ||
    featuredOnly;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = products.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q)) return false;
      if (availability === 'visible' && !p.available) return false;
      if (availability === 'hidden' && p.available) return false;
      if (stockFilter === 'low' && !isLowStock(p)) return false;
      if (featuredOnly && !p.featured) return false;
      return true;
    });

    if (sort === 'menu') return rows;
    return [...rows].sort((a, b) => {
      switch (sort) {
        case 'name':
          return a.name.localeCompare(b.name, 'fr');
        case 'price-desc':
          return b.price - a.price;
        case 'margin-asc': {
          // Les produits sans coût saisi n'ont pas de marge : on les renvoie en
          // fin de liste plutôt que de les traiter comme une marge de 0 %.
          const ma = marginPct(a);
          const mb = marginPct(b);
          if (ma === null && mb === null) return 0;
          if (ma === null) return 1;
          if (mb === null) return -1;
          return ma - mb;
        }
        case 'stock-asc': {
          // Stock illimité (`null`) en dernier : ce n'est jamais une alerte.
          const sa = a.stockQuantity;
          const sb = b.stockQuantity;
          if (sa === null && sb === null) return 0;
          if (sa === null) return 1;
          if (sb === null) return -1;
          return sa - sb;
        }
        default:
          return 0;
      }
    });
  }, [products, query, availability, stockFilter, featuredOnly, sort]);

  // Le réordonnancement échange le `sortOrder` de deux voisins réels. Sous
  // filtre ou sous tri alternatif, la ligne voisine à l'écran n'est pas la
  // voisine en base : on désactive les flèches plutôt que de produire un
  // déplacement inattendu.
  const reorderDisabledReason =
    sort !== 'menu'
      ? 'Repassez sur « Ordre du menu » pour réordonner'
      : isFiltered
        ? 'Réinitialisez les filtres pour réordonner'
        : undefined;

  const hiddenCount = products.filter((p) => !p.available).length;
  const lowStockCount = products.filter((p) => isLowStock(p)).length;

  // Position réelle dans la carte, pour désactiver la flèche des extrémités.
  const positions = useMemo(
    () => new Map(products.map((p, i) => [p.id, i])),
    [products]
  );

  function resetFilters() {
    setQuery('');
    setAvailability('all');
    setStockFilter('all');
    setFeaturedOnly(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-[260px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un produit…"
            className="h-9 pl-8"
            aria-label="Rechercher un produit"
          />
        </div>

        <Tabs
          value={availability}
          onValueChange={(v) => setAvailability(v as Availability)}
        >
          <TabsList>
            <TabsTrigger value="all">Tous</TabsTrigger>
            <TabsTrigger value="visible">Visibles</TabsTrigger>
            <TabsTrigger value="hidden">Masqués</TabsTrigger>
          </TabsList>
        </Tabs>

        <Button
          variant={stockFilter === 'low' ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => setStockFilter((s) => (s === 'low' ? 'all' : 'low'))}
          aria-pressed={stockFilter === 'low'}
        >
          Stock faible
          {lowStockCount > 0 && (
            <span className="ml-1.5 tabular-nums">({lowStockCount})</span>
          )}
        </Button>

        <div className="flex items-center gap-2">
          <Switch
            id="featured-only"
            checked={featuredOnly}
            onCheckedChange={setFeaturedOnly}
          />
          <Label htmlFor="featured-only" className="text-sm">
            En vedette
          </Label>
        </div>

        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger size="sm" className="w-[190px]" aria-label="Trier par">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
              <SelectItem key={key} value={key}>
                {SORT_LABELS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isFiltered && (
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Réinitialiser
          </Button>
        )}

        <span className="ml-auto text-sm text-muted-foreground">
          {filtered.length} / {products.length}
          {hiddenCount > 0 && ` · ${hiddenCount} masqué(s)`}
        </span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <span className="sr-only">Ordre</span>
            </TableHead>
            <TableHead className="hidden sm:table-cell">Image</TableHead>
            <TableHead>Nom</TableHead>
            <TableHead className="text-right">Prix</TableHead>
            <TableHead className="hidden text-right lg:table-cell">
              Coûts
            </TableHead>
            <TableHead className="hidden text-right md:table-cell">
              Marge
            </TableHead>
            <TableHead>Stock</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((p) => {
            const couts = p.coutMatiere + p.coutEmballage;
            const marge = p.price - couts;
            const pct = marginPct(p);
            const position = positions.get(p.id) ?? 0;
            return (
              <TableRow key={p.id}>
                <TableCell className="pr-0">
                  <div className="flex flex-col">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            disabled={
                              isMoving ||
                              position === 0 ||
                              Boolean(reorderDisabledReason)
                            }
                            onClick={() =>
                              startMove(() => moveProductAction(p.id, 'up'))
                            }
                            aria-label={`Monter ${p.name}`}
                          >
                            <ChevronUp className="size-3.5" />
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {reorderDisabledReason ?? 'Monter dans la carte'}
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            disabled={
                              isMoving ||
                              position === products.length - 1 ||
                              Boolean(reorderDisabledReason)
                            }
                            onClick={() =>
                              startMove(() => moveProductAction(p.id, 'down'))
                            }
                            aria-label={`Descendre ${p.name}`}
                          >
                            <ChevronDown className="size-3.5" />
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {reorderDisabledReason ?? 'Descendre dans la carte'}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  {p.imageUrl ? (
                    <Image
                      src={p.imageUrl}
                      alt={p.name}
                      width={48}
                      height={48}
                      className="size-12 rounded-md object-cover"
                    />
                  ) : (
                    <div
                      className="size-12 rounded-md bg-muted"
                      title="Aucune photo"
                    />
                  )}
                </TableCell>
                <TableCell className="font-medium">
                  <Link
                    href={`/dashboard/menu/${categoryId}/produits/${p.id}`}
                    className="hover:underline"
                  >
                    {p.name}
                  </Link>
                  {/* Repli mobile : la marge disparaît de sa colonne. */}
                  {pct !== null && (
                    <span className="block text-xs font-normal text-muted-foreground md:hidden">
                      marge {pct}%
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {priceFmt.format(p.price)} FCFA
                </TableCell>
                <TableCell className="hidden text-right text-sm tabular-nums text-muted-foreground lg:table-cell">
                  {couts > 0 ? (
                    <span>{priceFmt.format(couts)} FCFA</span>
                  ) : (
                    <span className="text-xs">—</span>
                  )}
                </TableCell>
                <TableCell className="hidden text-right md:table-cell">
                  {pct !== null ? (
                    <span
                      className={
                        pct >= 50
                          ? 'text-sm font-medium tabular-nums text-green-600'
                          : pct >= 20
                            ? 'text-sm font-medium tabular-nums text-yellow-600'
                            : 'text-sm font-medium tabular-nums text-destructive'
                      }
                    >
                      {priceFmt.format(marge)} F ({pct}%)
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <StockBadge stockQuantity={p.stockQuantity} />
                    {!!p.pending && (
                      <span
                        className="text-xs text-amber-700 dark:text-amber-400"
                        title="Quantité déjà demandée par des commandes non payées"
                      >
                        (dont {p.pending} en attente)
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant={p.available ? 'default' : 'outline'}>
                      {p.available ? 'Visible' : 'Masqué'}
                    </Badge>
                    {p.featured && (
                      <Badge variant="secondary">
                        ★ {p.featuredBadge ?? 'Favori'}
                      </Badge>
                    )}
                    {isPausedNow(p.unavailableUntil) && p.unavailableUntil && (
                      <Badge
                        variant="outline"
                        className="border-amber-400 text-amber-700 dark:text-amber-400"
                        title={`Reprise le ${formatAbidjanDateTime(p.unavailableUntil)}`}
                      >
                        En pause
                      </Badge>
                    )}
                    {p.scheduleName && (
                      <Badge variant="outline" title="Planning récurrent">
                        {p.scheduleName}
                      </Badge>
                    )}
                    {p.weeklySpecialPeriods.length > 0 &&
                      (() => {
                        if (isWithinAnyPeriod(p.weeklySpecialPeriods)) {
                          return (
                            <Badge
                              variant="outline"
                              className="border-emerald-400 text-emerald-700 dark:text-emerald-400"
                            >
                              Spécialité de la semaine
                            </Badge>
                          );
                        }
                        const next = nextUpcomingPeriod(p.weeklySpecialPeriods);
                        if (!next) return null;
                        return (
                          <Badge variant="outline">
                            Revient le {formatAbidjanShortDate(next.startDate)}
                          </Badge>
                        );
                      })()}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" size="sm" asChild>
                      <Link
                        href={`/dashboard/menu/${categoryId}/produits/${p.id}`}
                      >
                        Modifier
                      </Link>
                    </Button>
                    <ProductRowActions
                      id={p.id}
                      name={p.name}
                      available={p.available}
                      featured={p.featured}
                      stockQuantity={p.stockQuantity}
                    />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
          {filtered.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={9}
                className="py-8 text-center text-sm text-muted-foreground"
              >
                {products.length === 0
                  ? 'Aucun produit dans cette catégorie.'
                  : 'Aucun produit ne correspond aux filtres.'}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
