'use client';

import { useMemo, useState } from 'react';
import type { MenuCategory, Product } from '@/config/menu';
import { searchProducts } from '@/lib/catalog';
import { CatalogSearchBox } from './_components/catalog/catalog-search-box';
import { CategoryTabs } from './_components/catalog/category-tabs';
import { ProductGrid } from './_components/catalog/product-grid';

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
      <CatalogSearchBox search={search} onChange={setSearch} />

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
          <CategoryTabs
            menu={menu}
            activeCategoryId={activeCategoryId}
            onSelect={setActiveCategoryId}
          />

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
