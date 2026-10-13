'use client';

import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { RowActionsState } from './use-row-actions';

export function RestockInline({ actions }: { actions: RowActionsState }) {
  const {
    isPending,
    restockDelta,
    setRestockDelta,
    closeRestock,
    handleRestockConfirm,
  } = actions;
  return (
    <div className="flex items-center gap-1">
      <Input
        type="number"
        min={1}
        step={1}
        autoFocus
        placeholder="+N"
        value={restockDelta}
        onChange={(e) => setRestockDelta(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleRestockConfirm();
          if (e.key === 'Escape') closeRestock();
        }}
        className="h-9 w-16 px-2 text-sm"
        aria-label="Quantité à ajouter"
      />
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={isPending}
        onClick={handleRestockConfirm}
        aria-label="Confirmer le réapprovisionnement"
      >
        <Check className="size-4 text-green-600" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={isPending}
        onClick={closeRestock}
        aria-label="Annuler"
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}
