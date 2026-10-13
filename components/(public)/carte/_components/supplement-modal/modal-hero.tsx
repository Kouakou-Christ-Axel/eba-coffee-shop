'use client';

import { Button } from '@heroui/react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { priceFormatter, type Product } from '@/config/menu';
import { SHEET_OVERLAY_TOP } from '@/lib/bottom-sheet';
import {
  ProductBadge,
  ProductMedia,
  productBadgeLabel,
} from '../product-media';
import { ShareProductButton } from '../share-product-button';

export function ModalHero({
  product,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const badge = productBadgeLabel(product);
  return (
    <>
      <div className="relative h-64 w-full shrink-0 overflow-hidden sm:h-56">
        <ProductMedia
          product={product}
          sizes="(max-width: 640px) 100vw, 448px"
          monogramClassName="text-6xl"
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-20 bg-[linear-gradient(180deg,rgba(0,0,0,0.35)_0%,transparent_100%)]"
        />
        <div className={cn('absolute right-3 flex gap-2', SHEET_OVERLAY_TOP)}>
          <ShareProductButton product={product} />
          <Button
            isIconOnly
            size="sm"
            radius="full"
            aria-label="Fermer"
            onPress={onClose}
            className="min-h-9 min-w-9 bg-white/90 text-foreground shadow-md"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Le badge ouvre le bloc texte, sous la photo : en overlay il
              masquait une partie du visuel qui doit donner envie, et sa
              lisibilité dépendait de ce qu'il y avait dessous. */}
      <div className="px-6 pb-2 pt-4">
        {badge && <ProductBadge label={badge} className="mb-1.5" />}
        <h2 className="text-xl font-semibold tracking-tight">{product.name}</h2>
        <p className="mt-1 text-base font-bold text-primary">
          {priceFormatter.format(product.price)}&nbsp;F
        </p>
        {/* La description vend le produit : elle disparaissait justement au
                moment de la décision. */}
        {product.description && (
          <p className="mt-2 text-sm leading-relaxed text-foreground/65">
            {product.description}
          </p>
        )}
      </div>
    </>
  );
}
