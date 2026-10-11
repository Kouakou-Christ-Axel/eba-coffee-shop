'use client';

import { Reorder } from 'framer-motion';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import type { SupplementGroupIssues } from '@/lib/supplements-form';
import type { UiGroup, UiOption } from './model';
import { OptionCard } from './option-card';

export function GroupOptions({
  group,
  issues,
  reduceMotion,
  onAddOption,
  onUpdateOption,
  onRemoveOption,
  onReorderOptions,
}: {
  group: UiGroup;
  issues?: SupplementGroupIssues;
  reduceMotion: boolean;
  onAddOption: () => void;
  onUpdateOption: (optionUid: string, patch: Partial<UiOption>) => void;
  onRemoveOption: (option: UiOption) => void;
  onReorderOptions: (options: UiOption[]) => void;
}) {
  function reorderOptions(uids: string[]) {
    const byUid = new Map(group.options.map((o) => [o.uid, o]));
    onReorderOptions(
      uids
        .map((uid) => byUid.get(uid))
        .filter((o): o is UiOption => o !== undefined)
    );
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm">Options ({group.options.length})</Label>
      <p className="text-xs text-muted-foreground">
        Prix en FCFA (0 = compris dans le produit). Stock : « Illimité », ou une
        quantité — 0 signifie épuisé.
      </p>

      {group.options.length === 0 && (
        <p className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
          Aucune option. Un groupe doit en compter au moins une.
        </p>
      )}

      <Reorder.Group
        as="div"
        axis="y"
        values={group.options.map((o) => o.uid)}
        onReorder={reorderOptions}
        className="space-y-2"
      >
        {group.options.map((option, oi) => (
          <OptionCard
            key={option.uid}
            option={option}
            index={oi}
            error={issues?.options[oi] ?? null}
            reduceMotion={reduceMotion}
            onUpdate={(patch) => onUpdateOption(option.uid, patch)}
            onRemove={() => onRemoveOption(option)}
          />
        ))}
      </Reorder.Group>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onAddOption}
        className="h-11 w-full sm:h-9 sm:w-auto"
      >
        <Plus className="size-4" /> Ajouter une option
      </Button>
    </div>
  );
}
