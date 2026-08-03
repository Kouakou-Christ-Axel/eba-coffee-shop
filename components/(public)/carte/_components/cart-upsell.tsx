'use client';

// components/(public)/carte/_components/cart-upsell.tsx
//
// Vente additionnelle du panier — l'emplacement au plus fort rendement du
// tunnel : le client a déjà décidé d'acheter, ajouter une ligne ne lui coûte
// plus aucune décision d'engagement. On y proposait jusqu'ici « Vider le
// panier » et rien d'autre.

import dynamic from 'next/dynamic';
import { Button } from '@heroui/react';
import { Check, Plus } from 'lucide-react';
import { priceFormatter, type MenuCategory, type Product } from '@/config/menu';
import { isPausedNow } from '@/lib/supplements';
import { UPSELL_MAX_PRODUCTS } from '@/config/constants';
import { useQuickAdd } from './use-quick-add';
import { ProductMedia } from './product-media';

const SupplementModal = dynamic(
  () => import('@/components/(public)/carte/supplement-modal'),
  { ssr: false }
);

/**
 * Suggestions : produits commandables mis en avant (rang de vente d'abord,
 * puis mises en avant éditoriales) qui ne sont PAS déjà dans le panier —
 * reproposer ce que le client vient d'ajouter ne sert à rien.
 */
export function selectUpsellProducts(
  menu: MenuCategory[],
  productIdsInCart: string[]
): Product[] {
  const inCart = new Set(productIdsInCart);

  return menu
    .flatMap((category) => category.products)
    .filter(
      (p) =>
        !inCart.has(p.id) &&
        p.soldOut !== true &&
        !isPausedNow(p.unavailableUntil) &&
        (p.popularRank != null || p.featured)
    )
    .sort((a, b) => {
      // Les produits classés aux ventes passent devant les mises en avant
      // éditoriales ; à défaut de rang, on suit l'ordre du dashboard.
      const rankA = a.popularRank ?? Infinity;
      const rankB = b.popularRank ?? Infinity;
      if (rankA !== rankB) return rankA - rankB;
      return (a.featuredOrder ?? 0) - (b.featuredOrder ?? 0);
    })
    .slice(0, UPSELL_MAX_PRODUCTS);
}

function UpsellCard({ product }: { product: Product }) {
  const { hasOptions, justAdded, isModalOpen, closeModal, handleAdd } =
    useQuickAdd(product);

  return (
    <>
      <div className="w-32 shrink-0 snap-start">
        <div className="relative h-24 w-32 overflow-hidden rounded-xl">
          <ProductMedia
            product={product}
            sizes="128px"
            monogramClassName="text-3xl"
          />
          <Button
            isIconOnly
            size="sm"
            radius="full"
            color={justAdded ? 'success' : 'default'}
            aria-label={`Ajouter ${product.name}`}
            onPress={handleAdd}
            className={`absolute bottom-1.5 right-1.5 min-h-8 min-w-8 cursor-pointer shadow-md transition-transform duration-150 active:scale-90 ${
              justAdded ? 'text-white' : 'bg-white text-primary'
            }`}
          >
            {justAdded ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
        <p className="mt-1.5 truncate text-xs font-medium text-foreground">
          {product.name}
        </p>
        <p className="text-xs font-semibold text-primary">
          {priceFormatter.format(product.price)}&nbsp;F
        </p>
      </div>

      {hasOptions && (
        <SupplementModal
          product={product}
          isOpen={isModalOpen}
          onClose={closeModal}
        />
      )}
    </>
  );
}

export function CartUpsell({ products }: { products: Product[] }) {
  if (products.length === 0) return null;

  return (
    <div className="border-t border-foreground/5 pt-4">
      <p className="text-sm font-semibold text-foreground">
        Complétez votre commande
      </p>
      <div className="-mx-1 mt-2.5 overflow-x-auto px-1 pb-1 scrollbar-none">
        <div className="flex snap-x gap-3">
          {products.map((product) => (
            <UpsellCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </div>
  );
}
