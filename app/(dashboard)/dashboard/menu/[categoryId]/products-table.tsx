'use client';

import { useMemo } from 'react';
import { Reorder, useReducedMotion } from 'framer-motion';
import {
  Table,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useUndoToast } from '@/lib/hooks/use-undo-toast';
import { useResettableState } from '@/lib/hooks/use-resettable-state';
import { useTransition } from 'react';
import { reorderProductsAction } from '../actions';
import { EmptyProducts } from './_components/products/empty-products';
import { ProductFiltersBar } from './_components/products/product-filters-bar';
import { ProductTableRow } from './_components/products/product-table-row';
import type { ProductRow } from './_components/products/types';
import { useProductFilters } from './_components/products/use-product-filters';

export type { ProductRow };

export function ProductsTable({
  categoryId,
  products,
}: {
  categoryId: string;
  products: ProductRow[];
}) {
  const { pushToast } = useUndoToast();
  const reduceMotion = useReducedMotion();
  const [, startTransition] = useTransition();

  const filters = useProductFilters();
  const {
    debouncedQuery,
    availability,
    featuredOnly,
    hasFilters,
    resetFilters,
  } = filters;

  // Ordre local : glisser en cours et état optimiste. La clé sérialise les lignes entières pour se réinitialiser aussi sur un
  // renommage ou un changement de stock.
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

  // `sortOrder` porte sur la liste COMPLÈTE : pas de glisser ni de flèches tant qu'un filtre est actif.
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

  // Catégorie vide : ni tableau ni filtres, seulement l'invitation à créer un produit.
  if (products.length === 0) {
    return <EmptyProducts categoryId={categoryId} />;
  }

  return (
    <div className="space-y-4">
      <ProductFiltersBar
        filters={filters}
        shown={filtered.length}
        total={products.length}
      />

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
          // Sûr car le glisser est désactivé dès qu'un filtre est actif : `filtered` est alors la liste complète.
          onReorder={(next: ProductRow[]) => canReorder && setOrder(() => next)}
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
                Aucun produit ne correspond aux filtres.{' '}
                <button
                  type="button"
                  onClick={resetFilters}
                  className="underline underline-offset-4"
                >
                  Réinitialiser
                </button>
              </TableCell>
            </TableRow>
          )}
        </Reorder.Group>
      </Table>
    </div>
  );
}
