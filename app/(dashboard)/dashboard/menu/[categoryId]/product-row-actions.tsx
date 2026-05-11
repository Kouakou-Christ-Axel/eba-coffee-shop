'use client';

import { useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  toggleProductAvailabilityAction,
  deleteProductAction,
} from '../actions';

export function ProductRowActions({
  id,
  available,
}: {
  id: string;
  available: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <Switch
        checked={available}
        disabled={isPending}
        onCheckedChange={() =>
          startTransition(() => toggleProductAvailabilityAction(id))
        }
        aria-label="Disponibilité"
      />
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={isPending}
        onClick={() => {
          if (confirm('Supprimer ce produit ?')) {
            startTransition(() => deleteProductAction(id));
          }
        }}
        aria-label="Supprimer"
      >
        <Trash2 className="size-4 text-destructive" />
      </Button>
    </div>
  );
}
