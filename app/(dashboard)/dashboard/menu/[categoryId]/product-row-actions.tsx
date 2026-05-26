'use client';

import { useTransition } from 'react';
import { Star, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  toggleProductAvailabilityAction,
  toggleProductFeaturedAction,
  deleteProductAction,
} from '../actions';

export function ProductRowActions({
  id,
  available,
  featured,
}: {
  id: string;
  available: boolean;
  featured: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-3">
      <div
        className="flex items-center gap-1.5"
        title="Afficher dans les incontournables de la page d'accueil"
      >
        <Star
          className={`size-4 ${featured ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`}
        />
        <Switch
          checked={featured}
          disabled={isPending}
          onCheckedChange={() =>
            startTransition(() => toggleProductFeaturedAction(id))
          }
          aria-label="Mettre en avant"
        />
      </div>
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
