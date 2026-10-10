'use client';

import { useId, useState } from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import { GripVertical, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { UiOption } from './model';
import { ToggleRow } from './shared';

export function OptionCard({
  option,
  index,
  error,
  reduceMotion,
  onUpdate,
  onRemove,
}: {
  option: UiOption;
  index: number;
  error: string | null;
  reduceMotion: boolean;
  onUpdate: (patch: Partial<UiOption>) => void;
  onRemove: () => void;
}) {
  const id = useId();
  const controls = useDragControls();

  // Brouillon de saisie : sans lui, vider le champ le réécrirait aussitôt en `0` en pleine frappe.
  const [priceText, setPriceText] = useState(() =>
    option.price === 0 ? '' : String(option.price)
  );
  // Dernière quantité connue : Limité → Illimité → Limité ne la perd pas.
  const [lastStock, setLastStock] = useState(option.stockQuantity ?? 0);

  const unlimited = option.stockQuantity == null;

  return (
    <Reorder.Item
      as="div"
      value={option.uid}
      dragListener={false}
      dragControls={controls}
      layout="position"
      transition={reduceMotion ? { duration: 0 } : undefined}
      className={cn(
        'space-y-2 rounded-lg border bg-muted/30 p-3',
        error && 'border-destructive/50',
        !option.available && 'opacity-70'
      )}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={`Déplacer l’option ${index + 1}`}
          onPointerDown={(e) => controls.start(e)}
          className="flex size-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>
        <Label
          htmlFor={`${id}-name`}
          className="flex-1 text-xs font-medium text-muted-foreground"
        >
          Option {index + 1}
        </Label>
        <Button
          type="button"
          variant="ghost"
          onClick={onRemove}
          aria-label={`Supprimer l’option ${index + 1}`}
          className="size-10 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <Input
        id={`${id}-name`}
        value={option.name}
        placeholder="Nom du goût"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className="h-11 sm:h-9"
        onChange={(e) => onUpdate({ name: e.target.value })}
      />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label
            htmlFor={`${id}-price`}
            className="text-xs text-muted-foreground"
          >
            Prix (FCFA)
          </Label>
          <Input
            id={`${id}-price`}
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            placeholder="0"
            value={priceText}
            className="h-11 tabular-nums sm:h-9"
            onChange={(e) => {
              setPriceText(e.target.value);
              onUpdate({ price: Number(e.target.value) || 0 });
            }}
          />
        </div>

        <div className="space-y-1">
          <Label
            htmlFor={unlimited ? undefined : `${id}-stock`}
            className="text-xs text-muted-foreground"
          >
            Stock du jour
          </Label>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={unlimited ? 'default' : 'outline'}
              aria-pressed={unlimited}
              onClick={() =>
                onUpdate({ stockQuantity: null, stockTouched: true })
              }
              className="h-11 flex-1 sm:h-9"
            >
              Illimité
            </Button>
            {unlimited ? (
              <Button
                type="button"
                variant="outline"
                aria-pressed={false}
                onClick={() =>
                  onUpdate({ stockQuantity: lastStock, stockTouched: true })
                }
                className="h-11 flex-1 sm:h-9"
              >
                Limité
              </Button>
            ) : (
              <Input
                id={`${id}-stock`}
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                aria-label="Quantité restante"
                value={option.stockQuantity ?? ''}
                className="h-11 flex-1 tabular-nums sm:h-9"
                onChange={(e) => {
                  const next =
                    e.target.value === '' ? 0 : Number(e.target.value);
                  setLastStock(next);
                  onUpdate({ stockQuantity: next, stockTouched: true });
                }}
              />
            )}
          </div>
        </div>
      </div>

      <ToggleRow
        id={`${id}-available`}
        label="Disponible à la vente"
        checked={option.available}
        onChange={(available) => onUpdate({ available })}
      />

      {error && (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </Reorder.Item>
  );
}
