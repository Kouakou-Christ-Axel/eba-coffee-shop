'use client';

import type { Product } from '@/config/menu';
import { ProductTile } from './product-tile';
import type { CatalogCallbacks } from './types';

export function ProductGrid({
  products,
  subtitles,
  forFutureDay = false,
  onProductTap,
  onOpenOptions,
  onRestockProduct,
}: CatalogCallbacks & {
  products: Product[];
  /** Catégorie d'origine, affichée seulement en mode recherche. */
  subtitles?: string[];
  forFutureDay?: boolean;
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
