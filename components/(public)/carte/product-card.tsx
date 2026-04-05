// components/(public)/carte/product-card.tsx
'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Button } from '@heroui/react';
import { Plus } from 'lucide-react';
import { useCartStore } from '@/lib/cart-store';
import { priceFormatter, type Product } from '@/config/menu';
import SupplementModal from '@/components/(public)/carte/supplement-modal';

type ProductCardProps = {
  product: Product;
};

function ProductCard({ product }: ProductCardProps) {
  const { addItem } = useCartStore();
  const [showModal, setShowModal] = useState(false);
  const hasSups = product.supplements && product.supplements.length > 0;

  function handleAdd() {
    if (hasSups) {
      setShowModal(true);
    } else {
      addItem({
        productId: product.id,
        productName: product.name,
        basePrice: product.price,
        supplements: [],
      });
    }
  }

  return (
    <>
      <div className="group flex items-center gap-4 rounded-2xl border border-foreground/5 bg-white/60 p-3 transition-colors duration-200 hover:border-primary/10 hover:bg-white/80 sm:p-4">
        {/* Image */}
        {product.image ? (
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl sm:h-24 sm:w-24">
            <Image
              src={product.image}
              alt={product.name}
              fill
              sizes="96px"
              className="object-cover"
            />
          </div>
        ) : (
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-foreground/[0.03] sm:h-24 sm:w-24">
            <span className="text-2xl text-foreground/15">
              {product.name.charAt(0)}
            </span>
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold tracking-tight text-foreground sm:text-base">
            {product.name}
          </p>
          <p className="mt-0.5 text-xs text-foreground/50 sm:text-sm">
            {product.description}
          </p>
          <p className="mt-1.5 text-sm font-semibold text-primary">
            {priceFormatter.format(product.price)}&nbsp;F
          </p>
        </div>

        {/* Add button */}
        <Button
          isIconOnly
          size="sm"
          color="primary"
          variant="flat"
          radius="full"
          aria-label={`Ajouter ${product.name}`}
          onPress={handleAdd}
          className="shrink-0"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {hasSups && (
        <SupplementModal
          product={product}
          isOpen={showModal}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

export default ProductCard;
