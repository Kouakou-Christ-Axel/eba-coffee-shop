'use client';

import { Button } from '@/components/ui/button';
import { priceFormatter } from '@/config/menu';
import type { NewOrderStep } from '@/lib/hooks/use-new-order';

type Props = {
  step: NewOrderStep;
  itemsCount: number;
  totalItems: number;
  totalPrice: number;
  isSubmitting: boolean;
  onReview: () => void;
  onSubmit: () => void;
};

export function OrderBottomBar({
  step,
  itemsCount,
  totalItems,
  totalPrice,
  isSubmitting,
  onReview,
  onSubmit,
}: Props) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 border-t bg-background p-3 shadow-lg">
      <div className="mx-auto max-w-3xl">
        {step === 'catalog' ? (
          <Button
            type="button"
            size="lg"
            className="w-full"
            disabled={itemsCount === 0}
            onClick={onReview}
          >
            {itemsCount === 0
              ? 'Panier vide'
              : `Voir le panier · ${totalItems} article${totalItems > 1 ? 's' : ''} · ${priceFormatter.format(totalPrice)} F`}
          </Button>
        ) : (
          <Button
            type="button"
            size="lg"
            className="w-full"
            disabled={itemsCount === 0 || isSubmitting}
            onClick={onSubmit}
          >
            {isSubmitting
              ? 'Création…'
              : `Valider la commande · ${priceFormatter.format(totalPrice)} F`}
          </Button>
        )}
      </div>
    </div>
  );
}
