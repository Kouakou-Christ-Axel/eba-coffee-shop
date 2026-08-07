'use client';

import { useState, useTransition } from 'react';
import { ChevronUp, ChevronDown, Trash2, Pencil, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  ScheduleField,
  type ScheduleOption,
} from '@/components/(dashboard)/schedule-field';
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
  schedules,
  isFirst,
  isLast,
}: {
  id: string;
  name: string;
  available: boolean;
  scheduleId: string | null;
  advanceOrderDays: number | null;
  schedules: ScheduleOption[];
  isFirst: boolean;
  isLast: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(name);
  const [editScheduleId, setEditScheduleId] = useState<string | null>(
    scheduleId
  );
  const [editAdvanceOrderDays, setEditAdvanceOrderDays] = useState<
    number | null
  >(advanceOrderDays);

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
      await updateCategoryAction(id, {
        name: editName.trim(),
        scheduleId: editScheduleId,
        advanceOrderDays: editAdvanceOrderDays,
      });
      setIsEditing(false);
    });
  }

  if (isEditing) {
    return (
      <div className="space-y-2 rounded-md border bg-background p-3">
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
          />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={confirmRename}
            disabled={isPending || !editName.trim()}
            aria-label="Confirmer"
          >
            <Check className="size-4 text-green-600" />
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
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={isPending}
        onClick={startEdit}
        aria-label="Renommer"
      >
        <Pencil className="size-4" />
      </Button>
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
