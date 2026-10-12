'use client';

import { Plus } from 'lucide-react';
import { priceFormatter, type Product } from '@/config/menu';
import { ProductMedia } from '../product-media';
import { useQuickAdd, type QuickAddSink } from '../use-quick-add';
import { SupplementModal } from './lazy';

export function ReplacementCard({
  product,
  quantity,
  sink,
}: {
  product: Product;
  quantity: number;
  sink: QuickAddSink;
}) {
  const { hasOptions, isModalOpen, closeModal, handleAdd } = useQuickAdd(
    product,
    { sink, quantity }
  );

  return (
    <>
      <button
        type="button"
        onClick={handleAdd}
        aria-label={`Remplacer par ${product.name}`}
        className="w-28 shrink-0 cursor-pointer snap-start text-left"
      >
        <div className="relative h-24 w-28 overflow-hidden rounded-xl">
          <ProductMedia
            product={product}
            sizes="112px"
            monogramClassName="text-3xl"
          />
          <span className="absolute bottom-1.5 right-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-white text-primary shadow-md">
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </div>
        <p className="mt-1.5 truncate text-xs font-medium text-foreground">
          {product.name}
        </p>
        <p className="text-xs font-semibold text-primary">
          {priceFormatter.format(product.price)}&nbsp;F
        </p>
      </button>

      {hasOptions && (
        <SupplementModal
          product={product}
          isOpen={isModalOpen}
          onClose={closeModal}
          initialQuantity={quantity}
          strictStock
          onConfirm={sink}
        />
      )}
    </>
  );
}
