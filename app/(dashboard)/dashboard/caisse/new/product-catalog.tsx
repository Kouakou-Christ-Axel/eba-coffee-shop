'use client';

import { useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { priceFormatter, type MenuCategory, type Product } from '@/config/menu';

type Props = {
  menu: MenuCategory[];
  onProductTap: (product: Product) => void;
};

export function ProductCatalog({ menu, onProductTap }: Props) {
  const [activeCategoryId, setActiveCategoryId] = useState<string>(
    menu[0]?.id ?? ''
  );
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
      {/* Tabs catégories horizontales scrollables */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {menu.map((cat) => {
          const isActive = cat.id === activeCategoryId;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategoryId(cat.id)}
              className={cn(
                'shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
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

      {/* Grille produits */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {activeCategory.products.map((product) => (
          <button
            key={product.id}
            type="button"
            onClick={() => onProductTap(product)}
            className="group flex flex-col gap-2 rounded-xl border bg-card p-2 text-left transition-all hover:border-primary/40 hover:shadow-md active:scale-[0.98]"
          >
            {product.image ? (
              <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-muted">
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="aspect-square w-full rounded-lg bg-muted" />
            )}
            <div className="flex flex-1 flex-col">
              <p className="line-clamp-2 text-sm font-medium leading-tight">
                {product.name}
              </p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-primary">
                {priceFormatter.format(product.price)} F
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
