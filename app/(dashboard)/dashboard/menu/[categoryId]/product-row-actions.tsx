'use client';

import { useState, useTransition } from 'react';
import { Check, Package, Star, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  toggleProductAvailabilityAction,
  toggleProductFeaturedAction,
  deleteProductAction,
  restockProductAction,
} from '../actions';

export function ProductRowActions({
  id,
  available,
  featured,
  stockQuantity,
}: {
  id: string;
  available: boolean;
  featured: boolean;
  /** `null` = stock illimité : le réappro (« + fournée ») n'a pas de sens. */
  stockQuantity: number | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [isRestockOpen, setIsRestockOpen] = useState(false);
  const [restockDelta, setRestockDelta] = useState('');
  const [restockError, setRestockError] = useState<string | null>(null);

  function handleRestockConfirm() {
    const delta = Number(restockDelta);
    if (!Number.isInteger(delta) || delta <= 0) {
      setRestockError('Nombre invalide');
      return;
    }
    setRestockError(null);
    startTransition(async () => {
      try {
        await restockProductAction(id, delta);
        setIsRestockOpen(false);
        setRestockDelta('');
      } catch (err) {
        setRestockError(err instanceof Error ? err.message : 'Erreur');
      }
    });
  }

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
      {stockQuantity !== null &&
        (isRestockOpen ? (
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min={1}
              step={1}
              autoFocus
              placeholder="+N"
              value={restockDelta}
              onChange={(e) => setRestockDelta(e.target.value)}
              className="h-8 w-16 px-2 text-sm"
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
              onClick={() => {
                setIsRestockOpen(false);
                setRestockDelta('');
                setRestockError(null);
              }}
              aria-label="Annuler"
            >
              <X className="size-4" />
            </Button>
            {restockError && (
              <span className="text-xs text-destructive">
                {restockError}
              </span>
            )}
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={() => setIsRestockOpen(true)}
            title="Ajouter une nouvelle fournée au stock"
          >
            <Package className="mr-1 size-3.5" />+ fournée
          </Button>
        ))}
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
