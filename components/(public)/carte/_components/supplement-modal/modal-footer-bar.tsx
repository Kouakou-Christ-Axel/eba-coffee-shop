'use client';

import { Button } from '@heroui/react';
import { Minus, Plus } from 'lucide-react';
import { priceFormatter } from '@/config/menu';
import type { SupplementModalState } from './use-supplement-modal';

export function ModalFooterBar({ modal }: { modal: SupplementModalState }) {
  const {
    quantity,
    setQuantity,
    maxQuantity,
    canSubmit,
    soldOutForLater,
    runningTotal,
    blockingLabel,
    handleAdd,
  } = modal;
  return (
    <>
      <div className="flex shrink-0 items-center gap-1 rounded-full border border-foreground/10 p-1">
        <Button
          isIconOnly
          size="sm"
          variant="light"
          radius="full"
          aria-label="Diminuer la quantité"
          isDisabled={quantity <= 1}
          onPress={() => setQuantity((q) => Math.max(1, q - 1))}
        >
          <Minus className="size-3.5" />
        </Button>
        <span
          aria-live="polite"
          className="w-6 text-center text-sm font-semibold"
        >
          {quantity}
        </span>
        <Button
          isIconOnly
          size="sm"
          variant="light"
          radius="full"
          aria-label="Augmenter la quantité"
          isDisabled={quantity >= maxQuantity}
          onPress={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
        >
          <Plus className="size-3.5" />
        </Button>
      </div>

      <Button
        color="primary"
        className="flex-1"
        size="lg"
        onPress={handleAdd}
        isDisabled={!canSubmit}
      >
        {canSubmit
          ? `${soldOutForLater ? 'Précommander' : 'Ajouter'} — ${priceFormatter.format(runningTotal)} F`
          : blockingLabel}
      </Button>
    </>
  );
}
