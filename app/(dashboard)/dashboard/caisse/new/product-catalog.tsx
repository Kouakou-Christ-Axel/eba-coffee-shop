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

type Props = {
  menu: MenuCategory[];
  onProductTap: (product: Product) => void;
  /** Ouvre le sélecteur de suppléments à la demande (bouton « Options »). */
  onOpenOptions?: (product: Product) => void;
};

export function ProductCatalog({ menu, onProductTap, onOpenOptions }: Props) {
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
            onProductTap={onProductTap}
            onOpenOptions={onOpenOptions}
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
            onProductTap={onProductTap}
            onOpenOptions={onOpenOptions}
          />
        </>
      )}
    </div>
  );
}

function ProductGrid({
  products,
  subtitles,
  onProductTap,
  onOpenOptions,
}: {
  products: Product[];
  /** Catégorie d'origine, affichée seulement en mode recherche. */
  subtitles?: string[];
  onProductTap: (product: Product) => void;
  onOpenOptions?: (product: Product) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {products.map((product, index) => (
        <ProductTile
          key={product.id}
          product={product}
          subtitle={subtitles?.[index]}
          onProductTap={onProductTap}
          onOpenOptions={onOpenOptions}
        />
      ))}
    </div>
  );
}

function ProductTile({
  product,
  subtitle,
  onProductTap,
  onOpenOptions,
}: {
  product: Product;
  subtitle?: string;
  onProductTap: (product: Product) => void;
  onOpenOptions?: (product: Product) => void;
}) {
  const soldOut = isProductSoldOut(product);
  const remaining = product.remaining ?? product.stockQuantity;
  const lowStock =
    !soldOut &&
    remaining !== null &&
    remaining !== undefined &&
    remaining <= LOW_STOCK_THRESHOLD;

  // Le bouton « Options » n'a de sens que pour les produits dont le tap ajoute
  // directement : ceux qui imposent un choix ouvrent déjà le sélecteur.
  const showOptionsButton =
    !soldOut &&
    onOpenOptions !== undefined &&
    productHasOptions(product) &&
    !productNeedsPicker(product);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => onProductTap(product)}
        disabled={soldOut}
        aria-label={
          soldOut ? `${product.name} — épuisé` : `Ajouter ${product.name}`
        }
        className={cn(
          'group flex w-full flex-col gap-2 rounded-xl border bg-card p-2 text-left transition-all',
          soldOut
            ? 'cursor-not-allowed opacity-50'
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
              className={cn('object-cover', soldOut && 'grayscale')}
            />
          )}
          {soldOut && (
            <span className="absolute inset-x-1 top-1 rounded-md bg-foreground/80 px-1.5 py-0.5 text-center text-[11px] font-semibold uppercase tracking-wide text-background">
              Épuisé
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
    </div>
  );
}
