'use client';

import { useState, useTransition } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  MoreHorizontal,
  Package,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/(dashboard)/confirm-dialog';
import { useUndoToast } from '@/lib/hooks/use-undo-toast';
import { useResettableState } from '@/lib/hooks/use-resettable-state';
import {
  toggleProductAvailabilityAction,
  toggleProductFeaturedAction,
  deleteProductAction,
  restockProductAction,
  moveProductAction,
} from '../actions';

export function ProductRowActions({
  id,
  name,
  available,
  featured,
  stockQuantity,
  isFirst,
  isLast,
  /** Le tri par flèches porte sur la liste COMPLÈTE : le proposer sur une liste
   * filtrée ferait déplacer le produit par rapport à des voisins invisibles. */
  canReorder,
}: {
  id: string;
  name: string;
  available: boolean;
  featured: boolean;
  /** `null` = stock illimité : le réappro (« + fournée ») n'a pas de sens. */
  stockQuantity: number | null;
  isFirst: boolean;
  isLast: boolean;
  canReorder: boolean;
}) {
  const { pushToast } = useUndoToast();
  const [isPending, startTransition] = useTransition();
  const [isRestockOpen, setIsRestockOpen] = useState(false);
  const [restockDelta, setRestockDelta] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Miroirs optimistes : l'interrupteur bascule tout de suite, puis se
  // resynchronise sur la prop quand le re-rendu serveur arrive (sans
  // `useEffect` — pattern « Adjusting state when a prop changes »). En cas
  // d'échec on revient explicitement en arrière ; avant, la valeur restait
  // fausse en silence jusqu'au prochain rafraîchissement.
  const [optimisticAvailable, setOptimisticAvailable] = useResettableState(
    String(available),
    () => available
  );
  const [optimisticFeatured, setOptimisticFeatured] = useResettableState(
    String(featured),
    () => featured
  );

  function toggle(
    next: boolean,
    apply: (updater: (prev: boolean) => boolean) => void,
    action: () => Promise<{ ok: true } | { ok: false; error: string }>,
    labels: { on: string; off: string }
  ) {
    apply(() => next);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        pushToast(next ? labels.on : labels.off);
        return;
      }
      apply(() => !next);
      pushToast(result.error, 'error');
    });
  }

  function handleRestockConfirm() {
    const delta = Number(restockDelta);
    if (!Number.isInteger(delta) || delta <= 0) {
      pushToast('Quantité invalide : entrez un entier positif.', 'error');
      return;
    }
    startTransition(async () => {
      const result = await restockProductAction(id, delta);
      if (!result.ok) {
        pushToast(result.error, 'error');
        return;
      }
      setIsRestockOpen(false);
      setRestockDelta('');
      pushToast(`${name} : +${delta} en stock`);
    });
  }

  function handleMove(direction: 'up' | 'down') {
    startTransition(async () => {
      const result = await moveProductAction(id, direction);
      if (!result.ok) pushToast(result.error, 'error');
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteProductAction(id);
      setConfirmDelete(false);
      pushToast(result.ok ? `${name} supprimé` : result.error, result.ok ? 'success' : 'error');
    });
  }

  return (
    <div className="flex items-center justify-end gap-2 sm:gap-3">
      <div
        className="hidden items-center gap-1.5 sm:flex"
        title="Afficher dans les incontournables de la page d'accueil"
      >
        <Star
          className={`size-4 ${optimisticFeatured ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`}
        />
        <Switch
          checked={optimisticFeatured}
          disabled={isPending}
          onCheckedChange={(v) =>
            toggle(v, setOptimisticFeatured, () => toggleProductFeaturedAction(id), {
              on: `${name} mis en avant`,
              off: `${name} retiré des incontournables`,
            })
          }
          aria-label="Mettre en avant"
        />
      </div>

      <Switch
        checked={optimisticAvailable}
        disabled={isPending}
        onCheckedChange={(v) =>
          toggle(v, setOptimisticAvailable, () => toggleProductAvailabilityAction(id), {
            on: `${name} visible`,
            off: `${name} masqué`,
          })
        }
        aria-label="Disponibilité"
      />

      {isPending && (
        <Loader2
          className="size-4 shrink-0 animate-spin text-muted-foreground"
          aria-hidden="true"
        />
      )}

      {stockQuantity !== null && isRestockOpen ? (
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
              if (e.key === 'Escape') {
                setIsRestockOpen(false);
                setRestockDelta('');
              }
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
            onClick={() => {
              setIsRestockOpen(false);
              setRestockDelta('');
            }}
            aria-label="Annuler"
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={isPending}
              aria-label={`Autres actions pour ${name}`}
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {stockQuantity !== null && (
              <DropdownMenuItem onSelect={() => setIsRestockOpen(true)}>
                <Package className="size-4" />
                Ajouter une fournée
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              disabled={!canReorder || isFirst}
              onSelect={() => handleMove('up')}
            >
              <ChevronUp className="size-4" />
              Monter
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!canReorder || isLast}
              onSelect={() => handleMove('down')}
            >
              <ChevronDown className="size-4" />
              Descendre
            </DropdownMenuItem>
            {/* Le miroir mobile de l'interrupteur « en vedette », masqué sous sm. */}
            <DropdownMenuItem
              className="sm:hidden"
              onSelect={() =>
                toggle(
                  !optimisticFeatured,
                  setOptimisticFeatured,
                  () => toggleProductFeaturedAction(id),
                  {
                    on: `${name} mis en avant`,
                    off: `${name} retiré des incontournables`,
                  }
                )
              }
            >
              <Star className="size-4" />
              {optimisticFeatured ? 'Retirer des incontournables' : 'Mettre en avant'}
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => setConfirmDelete(true)}
            >
              <Trash2 className="size-4" />
              Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Supprimer « ${name} » ?`}
        description="Le produit disparaîtra de la carte et du dashboard. Les commandes passées le conservent."
        confirmLabel="Supprimer"
        destructive
        isPending={isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
