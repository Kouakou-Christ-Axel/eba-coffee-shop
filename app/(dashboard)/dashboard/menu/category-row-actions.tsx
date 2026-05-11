'use client';

import { useTransition } from 'react';
import { ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  toggleCategoryAvailabilityAction,
  moveCategoryAction,
  deleteCategoryAction,
} from './actions';

export function CategoryRowActions({
  id,
  available,
  isFirst,
  isLast,
}: {
  id: string;
  available: boolean;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <Switch
        checked={available}
        disabled={isPending}
        onCheckedChange={() =>
          startTransition(() => toggleCategoryAvailabilityAction(id))
        }
        aria-label="Disponibilité"
      />
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={isPending || isFirst}
        onClick={() => startTransition(() => moveCategoryAction(id, 'up'))}
        aria-label="Monter"
      >
        <ChevronUp className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={isPending || isLast}
        onClick={() => startTransition(() => moveCategoryAction(id, 'down'))}
        aria-label="Descendre"
      >
        <ChevronDown className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={isPending}
        onClick={() => {
          if (
            confirm(
              'Supprimer cette catégorie ? Tous ses produits seront aussi supprimés.'
            )
          ) {
            startTransition(() => deleteCategoryAction(id));
          }
        }}
        aria-label="Supprimer"
      >
        <Trash2 className="size-4 text-destructive" />
      </Button>
    </div>
  );
}
