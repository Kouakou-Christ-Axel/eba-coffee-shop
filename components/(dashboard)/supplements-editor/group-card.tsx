'use client';

import { useId } from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import { GripVertical, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  summarizeGroup,
  type SupplementGroupIssues,
} from '@/lib/supplements-form';
import { cn } from '@/lib/utils';
import { GroupFields } from './group-fields';
import { GroupOptions } from './group-options';
import type { UiGroup, UiOption } from './model';
import { ChevronRightIcon } from './shared';

export function GroupCard({
  group,
  issues,
  open,
  reduceMotion,
  onToggle,
  onUpdate,
  onRemove,
  onAddOption,
  onUpdateOption,
  onRemoveOption,
  onReorderOptions,
}: {
  group: UiGroup;
  issues?: SupplementGroupIssues;
  open: boolean;
  reduceMotion: boolean;
  onToggle: (open: boolean) => void;
  onUpdate: (patch: Partial<UiGroup>) => void;
  onRemove: () => void;
  onAddOption: () => void;
  onUpdateOption: (optionUid: string, patch: Partial<UiOption>) => void;
  onRemoveOption: (option: UiOption) => void;
  onReorderOptions: (options: UiOption[]) => void;
}) {
  const id = useId();
  const controls = useDragControls();

  const hasError = Boolean(
    issues && (issues.group.length > 0 || issues.options.some(Boolean))
  );

  return (
    <Reorder.Item
      as="div"
      value={group.uid}
      dragListener={false}
      dragControls={controls}
      layout="position"
      transition={reduceMotion ? { duration: 0 } : undefined}
    >
      <details
        open={open}
        onToggle={(e) => onToggle(e.currentTarget.open)}
        className={cn(
          'rounded-xl border bg-card open:shadow-sm',
          hasError && 'border-destructive/50'
        )}
      >
        {/* `list-none` retire le triangle natif (Firefox). */}
        <summary className="flex cursor-pointer list-none items-center gap-2 p-2">
          {/* Rotation pilotée par la prop : `open` est la source de vérité du repli. */}
          <span
            className={cn(
              'flex size-8 shrink-0 items-center justify-center text-muted-foreground transition-transform',
              open && 'rotate-90'
            )}
          >
            <ChevronRightIcon />
          </span>

          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">
              {group.name.trim() || (
                <span className="text-muted-foreground italic">
                  Nouveau groupe
                </span>
              )}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {summarizeGroup(group)}
            </span>
          </span>

          {hasError && (
            <span
              aria-label="Ce groupe contient une erreur"
              className="size-2 shrink-0 rounded-full bg-destructive"
            />
          )}
          {!group.available && (
            <Badge variant="secondary" className="shrink-0">
              Masqué
            </Badge>
          )}

          {/* Poignée dans le `summary` : `preventDefault` évite que l'activation replie le bloc en plus du drag. */}
          <button
            type="button"
            aria-label={`Déplacer le groupe ${group.name.trim() || 'sans nom'}`}
            onPointerDown={(e) => {
              e.preventDefault();
              controls.start(e);
            }}
            onClick={(e) => e.preventDefault()}
            className="flex size-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing"
          >
            <GripVertical className="size-4" />
          </button>
        </summary>

        <div className="space-y-4 border-t p-3 sm:p-4">
          <GroupFields
            id={id}
            group={group}
            issues={issues}
            onUpdate={onUpdate}
          />

          <GroupOptions
            group={group}
            issues={issues}
            reduceMotion={reduceMotion}
            onAddOption={onAddOption}
            onUpdateOption={onUpdateOption}
            onRemoveOption={onRemoveOption}
            onReorderOptions={onReorderOptions}
          />

          <div className="border-t pt-3">
            <Button
              type="button"
              variant="ghost"
              onClick={onRemove}
              className="h-11 w-full text-destructive hover:bg-destructive/10 hover:text-destructive sm:h-9 sm:w-auto"
            >
              <Trash2 className="size-4" /> Supprimer le groupe
            </Button>
          </div>
        </div>
      </details>
    </Reorder.Item>
  );
}
