'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Reorder, useDragControls, useReducedMotion } from 'framer-motion';
import { MediaImage as Image } from '@/components/ui/media-image';
import { GripVertical, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ProductRowActions } from './product-row-actions';
import { StockBadge } from '@/components/(dashboard)/stock-badge';
import { useUndoToast } from '@/lib/hooks/use-undo-toast';
import { useResettableState } from '@/lib/hooks/use-resettable-state';
import { reorderProductsAction } from '../actions';
import {
  isPausedNow,
  isWithinAnyPeriod,
  nextUpcomingPeriod,
} from '@/lib/supplements';
import { formatAbidjanDateTime, formatAbidjanShortDate } from '@/lib/timezone';

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
const SEARCH_DEBOUNCE_MS = 350;
type Availability = 'all' | 'visible' | 'hidden';

function isAvailability(v: string | null): v is Availability {
  return v === 'all' || v === 'visible' || v === 'hidden';
}

export function ProductsTable({
  categoryId,
  products,
}: {
  categoryId: string;
  products: ProductRow[];
}) {
  const searchParams = useSearchParams();
  const { pushToast } = useUndoToast();
  const reduceMotion = useReducedMotion();
  const [, startTransition] = useTransition();

  // Filtres initialisés depuis l'URL puis reflétés dedans : le filtrage est
  // purement client (les produits sont déjà chargés), donc on écrit l'URL avec
  // `history.replaceState` plutôt que `router.push` — inutile de refaire un
  // aller-retour serveur. Bénéfice : les filtres survivent à un aller-retour
  // vers la fiche produit, et une vue filtrée se partage par lien.
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '');
  const [availability, setAvailability] = useState<Availability>(() => {
    const v = searchParams.get('dispo');
    return isAvailability(v) ? v : 'all';
  });
  const [featuredOnly, setFeaturedOnly] = useState(
    () => searchParams.get('vedette') === '1'
  );
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(
      () => setDebouncedQuery(query),
      SEARCH_DEBOUNCE_MS
    );
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (debouncedQuery.trim()) params.set('q', debouncedQuery.trim());
    else params.delete('q');
    if (availability !== 'all') params.set('dispo', availability);
    else params.delete('dispo');
    if (featuredOnly) params.set('vedette', '1');
    else params.delete('vedette');
    const qs = params.toString();
    window.history.replaceState(
      null,
      '',
      qs ? `${window.location.pathname}?${qs}` : window.location.pathname
    );
  }, [debouncedQuery, availability, featuredOnly]);

  const hasFilters =
    debouncedQuery.trim() !== '' || availability !== 'all' || featuredOnly;

  function resetFilters() {
    setQuery('');
    setDebouncedQuery('');
    setAvailability('all');
    setFeaturedOnly(false);
  }

  // Ordre local : porte le glisser en cours et sert d'état optimiste. La clé
  // sérialise les lignes entières (et pas seulement les ids) pour que le state
  // se réinitialise aussi sur un renommage ou un changement de stock, pas
  // seulement sur un ajout/suppression. Une catégorie fait quelques dizaines
  // de produits.
  const [order, setOrder] = useResettableState(
    JSON.stringify(products),
    () => products
  );

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    return order.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q)) return false;
      if (availability === 'visible' && !p.available) return false;
      if (availability === 'hidden' && p.available) return false;
      if (featuredOnly && !p.featured) return false;
      return true;
    });
  }, [order, debouncedQuery, availability, featuredOnly]);

  // Le `sortOrder` porte sur la liste COMPLÈTE. Réordonner une liste filtrée
  // déplacerait le produit par rapport à des voisins invisibles : on désactive
  // le glisser et les flèches tant qu'un filtre est actif.
  const canReorder = !hasFilters;

  function persist(next: ProductRow[]) {
    const previous = order;
    setOrder(() => next);
    startTransition(async () => {
      const result = await reorderProductsAction(
        categoryId,
        next.map((p) => p.id)
      );
      if (!result.ok) {
        setOrder(() => previous);
        pushToast(result.error, 'error');
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-[260px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un produit…"
            className="h-9 pl-8 pr-8"
          />
          {query && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setQuery('')}
              aria-label="Effacer la recherche"
              className="absolute right-0.5 top-1/2 h-7 w-7 -translate-y-1/2"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Conteneur à scroll horizontal : sur mobile les onglets ne tiennent
            pas dans le viewport et élargiraient toute la page. */}
        <div className="min-w-0 max-w-full overflow-x-auto">
          <Tabs
            value={availability}
            onValueChange={(v) => setAvailability(v as Availability)}
            className="w-fit"
          >
            <TabsList>
              <TabsTrigger value="all">Tous</TabsTrigger>
              <TabsTrigger value="visible">Visibles</TabsTrigger>
              <TabsTrigger value="hidden">Masqués</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

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

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Réinitialiser
          </Button>
        )}

        <span className="ml-auto text-sm text-muted-foreground">
          {filtered.length} / {products.length}
        </span>
      </div>

      {hasFilters && products.length > 1 && (
        <p className="text-xs text-muted-foreground">
          Effacez les filtres pour réordonner les produits.
        </p>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">
              <span className="sr-only">Réordonner</span>
            </TableHead>
            <TableHead className="hidden sm:table-cell">Image</TableHead>
            <TableHead>Nom</TableHead>
            <TableHead>Prix</TableHead>
            <TableHead className="hidden md:table-cell">Coûts</TableHead>
            <TableHead className="hidden md:table-cell">Marge</TableHead>
            <TableHead>Stock</TableHead>
            <TableHead className="hidden lg:table-cell">Statut</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <Reorder.Group
          as="tbody"
          axis="y"
          values={filtered}
          // Sûr uniquement parce que le glisser est désactivé dès qu'un filtre
          // est actif : `filtered` est alors la liste complète. La garde évite
          // qu'un futur changement ne fasse silencieusement perdre les lignes
          // masquées en écrasant `order` avec une sous-liste.
          onReorder={(next: ProductRow[]) =>
            canReorder && setOrder(() => next)
          }
          layoutScroll
          className="[&_tr:last-child]:border-0"
        >
          {filtered.map((p, idx) => (
            <ProductTableRow
              key={p.id}
              product={p}
              categoryId={categoryId}
              isFirst={idx === 0}
              isLast={idx === filtered.length - 1}
              canReorder={canReorder}
              reduceMotion={!!reduceMotion}
              onDrop={() => persist(order)}
            />
          ))}
          {filtered.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={9}
                className="py-8 text-center text-sm text-muted-foreground"
              >
                {products.length === 0 ? (
                  'Aucun produit dans cette catégorie.'
                ) : (
                  <>
                    Aucun produit ne correspond aux filtres.{' '}
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="underline underline-offset-4"
                    >
                      Réinitialiser
                    </button>
                  </>
                )}
              </TableCell>
            </TableRow>
          )}
        </Reorder.Group>
      </Table>
    </div>
  );
}

function ProductTableRow({
  product: p,
  categoryId,
  isFirst,
  isLast,
  canReorder,
  reduceMotion,
  onDrop,
}: {
  product: ProductRow;
  categoryId: string;
  isFirst: boolean;
  isLast: boolean;
  canReorder: boolean;
  reduceMotion: boolean;
  onDrop: () => void;
}) {
  // `dragListener={false}` + poignée dédiée : un glisser démarré n'importe où
  // dans la ligne rendrait les interrupteurs et les liens inutilisables.
  const controls = useDragControls();
  const couts = p.coutMatiere + p.coutEmballage;
  const marge = p.price - couts;
  const pct = p.price > 0 ? Math.round((marge / p.price) * 100) : 0;

  return (
    <Reorder.Item
      as="tr"
      value={p}
      drag={canReorder ? 'y' : false}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDrop}
      layout="position"
      // `prefers-reduced-motion` : le réagencement devient instantané, mais le
      // glisser reste fonctionnel — réduire le mouvement n'est pas retirer une
      // fonctionnalité.
      transition={reduceMotion ? { duration: 0 } : undefined}
      className="border-b transition-colors hover:bg-muted/50"
    >
      <TableCell className="w-8 pr-0">
        <button
          type="button"
          disabled={!canReorder}
          onPointerDown={(e) => canReorder && controls.start(e)}
          className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-30"
          aria-label={`Déplacer ${p.name}`}
          title={
            canReorder
              ? `Déplacer ${p.name}`
              : 'Effacez les filtres pour réordonner'
          }
        >
          <GripVertical className="size-4" />
        </button>
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
          <div className="size-12 rounded-md bg-muted" />
        )}
      </TableCell>
      <TableCell className="font-medium">
        <Link
          href={`/dashboard/menu/${categoryId}/produits/${p.id}`}
          className="hover:underline"
        >
          {p.name}
        </Link>
        {/* Le statut disparaît sous lg : on garde l'essentiel sous le nom. */}
        <span className="mt-1 flex flex-wrap gap-1 lg:hidden">
          <ProductStatusBadges product={p} />
        </span>
      </TableCell>
      <TableCell className="tabular-nums">
        {priceFmt.format(p.price)} FCFA
      </TableCell>
      <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
        {couts > 0 ? (
          <span>{priceFmt.format(couts)} FCFA</span>
        ) : (
          <span className="text-xs">—</span>
        )}
      </TableCell>
      <TableCell className="hidden md:table-cell">
        {couts > 0 && p.price > 0 ? (
          <span
            className={
              pct >= 50
                ? 'text-sm font-medium text-green-600'
                : pct >= 20
                  ? 'text-sm font-medium text-yellow-600'
                  : 'text-sm font-medium text-destructive'
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
      <TableCell className="hidden lg:table-cell">
        <div className="flex flex-wrap items-center gap-1.5">
          <ProductStatusBadges product={p} />
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="hidden md:inline-flex"
          >
            <Link href={`/dashboard/menu/${categoryId}/produits/${p.id}`}>
              Modifier
            </Link>
          </Button>
          <ProductRowActions
            id={p.id}
            name={p.name}
            available={p.available}
            featured={p.featured}
            stockQuantity={p.stockQuantity}
            isFirst={isFirst}
            isLast={isLast}
            canReorder={canReorder}
          />
        </div>
      </TableCell>
    </Reorder.Item>
  );
}

function ProductStatusBadges({ product: p }: { product: ProductRow }) {
  const special = (() => {
    if (p.weeklySpecialPeriods.length === 0) return null;
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
  })();

  return (
    <>
      <Badge variant={p.available ? 'default' : 'outline'}>
        {p.available ? 'Visible' : 'Masqué'}
      </Badge>
      {p.featured && (
        <Badge variant="secondary">★ {p.featuredBadge ?? 'Favori'}</Badge>
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
      {special}
    </>
  );
}
