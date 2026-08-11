'use client';

import { useState, useTransition } from 'react';
import { ChevronUp, ChevronDown, Trash2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { ScheduleOption } from '@/components/(dashboard)/schedule-field';
import { CategoryEditSheet } from './category-edit-sheet';
import {
  toggleCategoryAvailabilityAction,
  moveCategoryAction,
  deleteCategoryAction,
} from './actions';

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
  reorderDisabledReason,
}: {
  id: string;
  name: string;
  available: boolean;
  scheduleId: string | null;
  advanceOrderDays: number | null;
  productCount: number;
  schedules: ScheduleOption[];
  isFirst: boolean;
  isLast: boolean;
  /** Non vide quand un filtre masque des lignes : l'ordre affiché ≠ ordre réel. */
  reorderDisabledReason?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [isEditOpen, setIsEditOpen] = useState(false);

  const reorderLocked = Boolean(reorderDisabledReason);

  return (
    <>
      <div className="flex items-center justify-end gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={isPending}
              onClick={() => setIsEditOpen(true)}
              aria-label={`Modifier la catégorie ${name}`}
            >
              <Pencil className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Modifier</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex px-1">
              <Switch
                checked={available}
                disabled={isPending}
                onCheckedChange={() =>
                  startTransition(() => toggleCategoryAvailabilityAction(id))
                }
                aria-label={
                  available
                    ? `Masquer la catégorie ${name}`
                    : `Afficher la catégorie ${name}`
                }
              />
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {available ? 'Masquer de la carte' : 'Afficher sur la carte'}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={isPending || isFirst || reorderLocked}
                onClick={() =>
                  startTransition(() => moveCategoryAction(id, 'up'))
                }
                aria-label={`Monter ${name}`}
              >
                <ChevronUp className="size-4" />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>{reorderDisabledReason ?? 'Monter'}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={isPending || isLast || reorderLocked}
                onClick={() =>
                  startTransition(() => moveCategoryAction(id, 'down'))
                }
                aria-label={`Descendre ${name}`}
              >
                <ChevronDown className="size-4" />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {reorderDisabledReason ?? 'Descendre'}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={isPending}
              onClick={() => {
                const warning =
                  productCount > 0
                    ? `Supprimer « ${name} » ? Ses ${productCount} produit(s) seront aussi supprimés.`
                    : `Supprimer « ${name} » ?`;
                if (confirm(warning)) {
                  startTransition(() => deleteCategoryAction(id));
                }
              }}
              aria-label={`Supprimer la catégorie ${name}`}
            >
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Supprimer</TooltipContent>
        </Tooltip>
      </div>

      <CategoryEditSheet
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        id={id}
        name={name}
        scheduleId={scheduleId}
        advanceOrderDays={advanceOrderDays}
        schedules={schedules}
      />
    </>
  );
}
