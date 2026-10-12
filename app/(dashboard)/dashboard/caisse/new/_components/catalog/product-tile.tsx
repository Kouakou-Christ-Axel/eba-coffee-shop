'use client';

import { SlidersHorizontal } from 'lucide-react';
import { MediaImage as Image } from '@/components/ui/media-image';
import { cn } from '@/lib/utils';
import { priceFormatter, type Product } from '@/config/menu';
import {
  isProductSoldOut,
  productHasOptions,
  productNeedsPicker,
} from '@/lib/catalog';
import { LOW_STOCK_THRESHOLD } from '@/config/constants';
import { RestockControl } from '../../../_components/restock-control';
import type { CatalogCallbacks } from './types';

export function ProductTile({
  product,
  subtitle,
  forFutureDay = false,
  onProductTap,
  onOpenOptions,
  onRestockProduct,
}: CatalogCallbacks & {
  product: Product;
  subtitle?: string;
  forFutureDay?: boolean;
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
          {!!product.pending && (
            <p
              className="text-xs text-amber-700 dark:text-amber-400"
              title="Quantité déjà demandée par des commandes non payées"
            >
              dont {product.pending} en attente
            </p>
          )}
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
