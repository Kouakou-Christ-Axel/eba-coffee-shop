'use client';

import { useState, useTransition } from 'react';
import {
  ChevronUp,
  ChevronDown,
  Loader2,
  Trash2,
  Pencil,
  Check,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  ScheduleField,
  type ScheduleOption,
} from '@/components/(dashboard)/schedule-field';
import { ConfirmDialog } from '@/components/(dashboard)/confirm-dialog';
import { useUndoToast } from '@/lib/hooks/use-undo-toast';
import { useResettableState } from '@/lib/hooks/use-resettable-state';
import {
  toggleCategoryAvailabilityAction,
  moveCategoryAction,
  deleteCategoryAction,
  updateCategoryAction,
} from './actions';
import { ADVANCE_ORDER_DAYS_MAX } from '@/config/constants';

export function CategoryRowActions({
  id,
  name,
  available,
  scheduleId,
  advanceOrderDays,
  productCount,
  schedules,
  isFirst,
  isLast,
}: {
  id: string;
  name: string;
  available: boolean;
  scheduleId: string | null;
  advanceOrderDays: number | null;
  /** Affiché dans la confirmation : la suppression emporte les produits. */
  productCount: number;
  schedules: ScheduleOption[];
  isFirst: boolean;
  isLast: boolean;
}) {
  const { pushToast } = useUndoToast();
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editName, setEditName] = useState(name);
  const [editScheduleId, setEditScheduleId] = useState<string | null>(
    scheduleId
  );
  const [editAdvanceOrderDays, setEditAdvanceOrderDays] = useState<
    number | null
  >(advanceOrderDays);

  // Miroir optimiste : l'interrupteur bascule tout de suite et revient en
  // arrière si le serveur refuse, au lieu de rester silencieusement faux.
  // Resynchronisé sur la prop sans `useEffect` (pattern « Adjusting state when
  // a prop changes »).
  const [optimisticAvailable, setOptimisticAvailable] = useResettableState(
    String(available),
    () => available
  );

  function startEdit() {
    setEditName(name);
    setEditScheduleId(scheduleId);
    setEditAdvanceOrderDays(advanceOrderDays);
    setIsEditing(true);
  }

  function cancelEdit() {
    setEditName(name);
    setEditScheduleId(scheduleId);
    setEditAdvanceOrderDays(advanceOrderDays);
    setIsEditing(false);
  }

  function confirmRename() {
    if (!editName.trim()) {
      cancelEdit();
      return;
    }
    if (
      editName.trim() === name &&
      editScheduleId === scheduleId &&
      editAdvanceOrderDays === advanceOrderDays
    ) {
      cancelEdit();
      return;
    }
    startTransition(async () => {
      const result = await updateCategoryAction(id, {
        name: editName.trim(),
        scheduleId: editScheduleId,
        advanceOrderDays: editAdvanceOrderDays,
      });
      if (!result.ok) {
        pushToast(result.error, 'error');
        return;
      }
      setIsEditing(false);
      pushToast('Catégorie enregistrée');
    });
  }

  function handleToggle(next: boolean) {
    setOptimisticAvailable(() => next);
    startTransition(async () => {
      const result = await toggleCategoryAvailabilityAction(id);
      if (result.ok) {
        pushToast(next ? `${name} visible` : `${name} masquée`);
        return;
      }
      setOptimisticAvailable(() => !next);
      pushToast(result.error, 'error');
    });
  }

  function handleMove(direction: 'up' | 'down') {
    startTransition(async () => {
      const result = await moveCategoryAction(id, direction);
      if (!result.ok) pushToast(result.error, 'error');
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteCategoryAction(id);
      setConfirmDelete(false);
      pushToast(
        result.ok ? `${name} supprimée` : result.error,
        result.ok ? 'success' : 'error'
      );
    });
  }

  if (isEditing) {
    return (
      <div className="space-y-2 rounded-md border bg-background p-3 text-left">
        <div className="flex items-center gap-1">
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirmRename();
              if (e.key === 'Escape') cancelEdit();
            }}
            className="h-8 w-40 text-sm"
            autoFocus
            disabled={isPending}
            aria-label="Nom de la catégorie"
          />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={confirmRename}
            disabled={isPending || !editName.trim()}
            aria-label="Confirmer"
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4 text-green-600" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={cancelEdit}
            disabled={isPending}
            aria-label="Annuler"
          >
            <X className="size-4" />
          </Button>
        </div>
        <ScheduleField
          schedules={schedules}
          scheduleId={editScheduleId}
          onChange={setEditScheduleId}
          label="Planning récurrent"
          helpText="Ex. « menu brunch » disponible le week-end seulement."
        />
        <div className="space-y-1">
          <Input
            type="number"
            min={1}
            max={ADVANCE_ORDER_DAYS_MAX}
            step={1}
            placeholder="Commande à l'avance (jours)"
            value={editAdvanceOrderDays ?? ''}
            onChange={(e) =>
              setEditAdvanceOrderDays(
                e.target.value === '' ? null : Number(e.target.value)
              )
            }
            className="h-8 text-sm"
            disabled={isPending}
            aria-label="Commande à l'avance (jours)"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-1 sm:gap-2">
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={isPending}
        onClick={startEdit}
        aria-label={`Renommer ${name}`}
      >
        <Pencil className="size-4" />
      </Button>
      <Switch
        checked={optimisticAvailable}
        disabled={isPending}
        onCheckedChange={handleToggle}
        aria-label="Disponibilité"
      />
      {isPending ? (
        <Loader2
          className="size-4 shrink-0 animate-spin text-muted-foreground"
          aria-hidden="true"
        />
      ) : (
        <span className="size-4 shrink-0" aria-hidden="true" />
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        className="hidden sm:inline-flex"
        disabled={isPending || isFirst}
        onClick={() => handleMove('up')}
        aria-label={`Monter ${name}`}
      >
        <ChevronUp className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        className="hidden sm:inline-flex"
        disabled={isPending || isLast}
        onClick={() => handleMove('down')}
        aria-label={`Descendre ${name}`}
      >
        <ChevronDown className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={isPending}
        onClick={() => setConfirmDelete(true)}
        aria-label={`Supprimer ${name}`}
      >
        <Trash2 className="size-4 text-destructive" />
      </Button>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Supprimer « ${name} » ?`}
        description={
          productCount > 0
            ? `Ses ${productCount} produit${productCount > 1 ? 's' : ''} seront supprimés aussi et disparaîtront de la carte.`
            : 'Cette catégorie ne contient aucun produit.'
        }
        confirmLabel="Supprimer"
        destructive
        isPending={isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
