'use client';

import { useMemo, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { MediaImage as Image } from '@/components/ui/media-image';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { priceFormatter, type MenuCategory, type Product } from '@/config/menu';
import {
  isProductSoldOut,
  productHasOptions,
  productNeedsPicker,
  searchProducts,
} from '@/lib/catalog';
import { LOW_STOCK_THRESHOLD } from '@/config/constants';
import { RestockControl } from '../_components/restock-control';

type Props = {
  menu: MenuCategory[];
  /**
   * La commande en cours est pour un JOUR CIVIL ULTÉRIEUR : le stock
   * d'aujourd'hui ne s'y applique pas. Les produits épuisés restent
   * signalés (« Épuisé aujourd'hui ») mais redeviennent commandables.
   */
  forFutureDay?: boolean;
  onProductTap: (product: Product) => void;
  /** Ouvre le sélecteur de suppléments à la demande (bouton « Options »). */
  onOpenOptions?: (product: Product) => void;
  /** Réappro rapide du stock du PRODUIT (pas d'un goût) depuis sa tuile. */
  onRestockProduct?: (productId: string, stock: number | null) => void;
};

export function ProductCatalog({
  menu,
  forFutureDay = false,
  onProductTap,
  onOpenOptions,
  onRestockProduct,
}: Props) {
  const [activeCategoryId, setActiveCategoryId] = useState<string>(
    menu[0]?.id ?? ''
  );
  const [search, setSearch] = useState('');

  // Recherche : purement client, le menu entier est déjà en mémoire (aucun
  // debounce nécessaire — même raison que `_components/caisse-search.tsx`).
  const hits = useMemo(() => searchProducts(menu, search), [menu, search]);
  const searching = hits !== null;

  const activeCategory = menu.find((c) => c.id === activeCategoryId) ?? menu[0];

  if (!activeCategory) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
        Aucun produit disponible.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative w-full">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un produit…"
          aria-label="Rechercher un produit"
          className="h-11 pl-8 pr-9 text-base"
        />
        {search && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setSearch('')}
            aria-label="Effacer la recherche"
            className="absolute right-1 top-1/2 h-9 w-9 -translate-y-1/2"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* En recherche, les onglets de catégorie disparaissent : le caissier
          cherche UN produit précis, pas à naviguer la carte. */}
      {searching ? (
        hits.length === 0 ? (
          <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
            Aucun produit ne correspond à « {search.trim()} ».
          </div>
        ) : (
          <ProductGrid
            products={hits.map((h) => h.product)}
            subtitles={hits.map((h) => h.categoryName)}
            forFutureDay={forFutureDay}
            onProductTap={onProductTap}
            onOpenOptions={onOpenOptions}
            onRestockProduct={onRestockProduct}
          />
        )
      ) : (
        <>
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {menu.map((cat) => {
              const isActive = cat.id === activeCategoryId;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategoryId(cat.id)}
                  className={cn(
                    'h-11 shrink-0 rounded-full px-4 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/70'
                  )}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>

          <ProductGrid
            products={activeCategory.products}
            forFutureDay={forFutureDay}
            onProductTap={onProductTap}
            onOpenOptions={onOpenOptions}
            onRestockProduct={onRestockProduct}
          />
        </>
      )}
    </div>
  );
}

function ProductGrid({
  products,
  subtitles,
  forFutureDay = false,
  onProductTap,
  onOpenOptions,
  onRestockProduct,
}: {
  products: Product[];
  /** Catégorie d'origine, affichée seulement en mode recherche. */
  subtitles?: string[];
  forFutureDay?: boolean;
  onProductTap: (product: Product) => void;
  onOpenOptions?: (product: Product) => void;
  onRestockProduct?: (productId: string, stock: number | null) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {products.map((product, index) => (
        <ProductTile
          key={product.id}
          product={product}
          subtitle={subtitles?.[index]}
          forFutureDay={forFutureDay}
          onProductTap={onProductTap}
          onOpenOptions={onOpenOptions}
          onRestockProduct={onRestockProduct}
        />
      ))}
    </div>
  );
}

function ProductTile({
  product,
  subtitle,
  forFutureDay = false,
  onProductTap,
  onOpenOptions,
  onRestockProduct,
}: {
  product: Product;
  subtitle?: string;
  forFutureDay?: boolean;
  onProductTap: (product: Product) => void;
  onOpenOptions?: (product: Product) => void;
  onRestockProduct?: (productId: string, stock: number | null) => void;
}) {
  const soldOut = isProductSoldOut(product);
  // Le stock d'AUJOURD'HUI ne bloque pas une commande pour un autre jour : la
  // marchandise sera produite d'ici là. On garde l'information à l'écran (elle
  // reste utile au caissier), mais elle n'interdit plus le geste.
  const blocked = soldOut && !forFutureDay;
  const remaining = product.remaining ?? product.stockQuantity;
  const lowStock =
    !soldOut &&
    remaining !== null &&
    remaining !== undefined &&
    remaining <= LOW_STOCK_THRESHOLD;

  // Le bouton « Options » n'a de sens que pour les produits dont le tap ajoute
  // directement : ceux qui imposent un choix ouvrent déjà le sélecteur.
  const showOptionsButton =
    !blocked &&
    onOpenOptions !== undefined &&
    productHasOptions(product) &&
    !productNeedsPicker(product);

  // Contrairement au bouton « Options », reste affiché même produit épuisé :
  // c'est justement le cas d'usage principal (une fournée sort de cuisine
  // pour un produit affiché « Épuisé », il faut pouvoir corriger le stock
  // sans quitter l'écran).
  const showRestockButton =
    onRestockProduct !== undefined && product.stockQuantity != null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => onProductTap(product)}
        aria-label={
          soldOut
            ? forFutureDay
              ? `Ajouter ${product.name} — épuisé aujourd'hui, produit pour la date choisie`
              : `${product.name} — épuisé aujourd'hui, choisir un autre jour`
            : `Ajouter ${product.name}`
        }
        className={cn(
          'group flex w-full flex-col gap-2 rounded-xl border bg-card p-2 text-left transition-all',
          blocked
            ? 'opacity-60'
            : 'hover:border-primary/40 hover:shadow-md active:scale-[0.98]'
        )}
      >
        <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-muted">
          {product.image && (
            <Image
              src={product.image}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
              className={cn('object-cover', blocked && 'grayscale')}
            />
          )}
          {soldOut && (
            <span
              className={cn(
                'absolute inset-x-1 top-1 rounded-md px-1.5 py-0.5 text-center text-[11px] font-semibold uppercase tracking-wide',
                forFutureDay
                  ? 'bg-amber-500/90 text-white'
                  : 'bg-foreground/80 text-background'
              )}
            >
              {forFutureDay ? 'Épuisé aujourd’hui' : 'Épuisé'}
            </span>
          )}
          {lowStock && (
            <span className="absolute inset-x-1 top-1 rounded-md bg-amber-500/90 px-1.5 py-0.5 text-center text-[11px] font-semibold text-white">
              Reste {remaining}
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col">
          <p className="line-clamp-2 text-sm font-medium leading-tight">
            {product.name}
          </p>
          {subtitle && (
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          )}
          <p className="mt-1 text-sm font-semibold tabular-nums text-primary">
            {priceFormatter.format(product.price)} F
          </p>
        </div>
      </button>

      {showOptionsButton && (
        <button
          type="button"
          onClick={() => onOpenOptions(product)}
          title={`Options de ${product.name}`}
          aria-label={`Options de ${product.name}`}
          className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-full bg-background/90 text-muted-foreground shadow-sm ring-1 ring-border transition-colors hover:bg-muted hover:text-foreground"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
        </button>
      )}

      {showRestockButton && (
        <div className="absolute left-1 top-1">
          <RestockControl
            compact
            ariaLabel={`Réapprovisionner ${product.name}`}
            body={{ target: 'product', productId: product.id }}
            currentStock={remaining ?? product.stockQuantity ?? null}
            onDone={(stock) => onRestockProduct?.(product.id, stock)}
          />
        </div>
      )}
    </div>
  );
}
