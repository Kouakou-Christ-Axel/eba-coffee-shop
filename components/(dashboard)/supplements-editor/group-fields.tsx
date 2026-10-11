'use client';

import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  GROUP_TYPES,
  type SupplementGroupIssues,
  type SupplementGroupType,
} from '@/lib/supplements-form';
import type { UiGroup } from './model';
import { ToggleRow } from './shared';

export function GroupFields({
  id,
  group,
  issues,
  onUpdate,
}: {
  id: string;
  group: UiGroup;
  issues?: SupplementGroupIssues;
  onUpdate: (patch: Partial<UiGroup>) => void;
}) {
  // Les bornes ne se déduisent pas des valeurs : à l'ouverture du volet, min et max valent encore `null`.
  const [showBounds, setShowBounds] = useState(
    group.minSelect != null || group.maxSelect != null
  );

  return (
    <>
      {issues && issues.group.length > 0 && (
        <ul className="space-y-1 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {issues.group.map((message) => (
            <li key={message} className="flex gap-1.5">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              {message}
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-name`}>Nom du groupe</Label>
          <Input
            id={`${id}-name`}
            value={group.name}
            placeholder="ex : Choix du lait"
            className="h-11 sm:h-9"
            onChange={(e) => onUpdate({ name: e.target.value })}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`${id}-type`}>Type de choix</Label>
          <Select
            value={group.type}
            onValueChange={(value) =>
              onUpdate({ type: value as SupplementGroupType })
            }
          >
            {/* `h-11` nu ne l'emporte pas sur `data-[size=default]:h-9` (groupes tailwind-merge distincts). */}
            <SelectTrigger
              id={`${id}-type`}
              className="w-full data-[size=default]:h-11 sm:data-[size=default]:h-9"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(GROUP_TYPES).map(([value, { label }]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {GROUP_TYPES[group.type].help}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <ToggleRow
          id={`${id}-required`}
          label="Choix obligatoire"
          checked={group.required}
          onChange={(required) => onUpdate({ required })}
        />
        <ToggleRow
          id={`${id}-available`}
          label="Afficher ce groupe"
          checked={group.available}
          onChange={(available) => onUpdate({ available })}
        />
      </div>

      {group.type !== 'single' && (
        <div className="space-y-2">
          <ToggleRow
            id={`${id}-bounds`}
            label={
              group.type === 'quantity'
                ? 'Limiter la quantité totale'
                : 'Limiter le nombre de choix'
            }
            checked={showBounds}
            onChange={(next) => {
              setShowBounds(next);
              if (!next) onUpdate({ minSelect: null, maxSelect: null });
            }}
          />
          {showBounds && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-min`}>Minimum</Label>
                <Input
                  id={`${id}-min`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="Aucun"
                  value={group.minSelect ?? ''}
                  className="h-11 tabular-nums sm:h-9"
                  onChange={(e) =>
                    onUpdate({
                      minSelect:
                        e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-max`}>Maximum</Label>
                <Input
                  id={`${id}-max`}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  placeholder="Aucun"
                  value={group.maxSelect ?? ''}
                  className="h-11 tabular-nums sm:h-9"
                  onChange={(e) =>
                    onUpdate({
                      maxSelect:
                        e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                />
              </div>
              {group.type === 'quantity' && (
                <p className="col-span-2 text-xs text-muted-foreground">
                  Pour une quantité fixe (ex. 3 parts), mettez le même nombre en
                  minimum et en maximum.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
