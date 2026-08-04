'use client';

// components/(public)/carte/_components/portion-composer.tsx
//
// Composition d'une boîte à parts fixes (ex. « Sponge Cake x4 » : 4 sponges à
// répartir entre les goûts disponibles).
//
// L'ancienne présentation — une liste de 9 goûts avec un compteur −/+ chacun —
// demandait au client de faire l'arithmétique et de garder « 4 » en tête. Son
// modèle mental est pourtant l'inverse : « j'ai une boîte de 4 cases, qu'est-ce
// que je mets dedans ? ». On montre donc la boîte, et les goûts servent à la
// remplir. Le cas courant (2 goûts, 2 parts chacun) se fait en 4 appuis, sans
// jamais compter.
//
// Le nombre de cases vient de la CONFIG du groupe (`portionCount`), pas d'une
// constante : une autre référence pourra faire 3 ou 6 parts sans toucher au
// code.

import { Button } from '@heroui/react';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SupplementGroup } from '@/config/menu';
import {
  portionCount,
  portionSlots,
  stripPortionSuffix,
  type Selections,
} from '@/lib/supplements';

type Props = {
  group: SupplementGroup;
  selections: Selections;
  /** Applique de nouveaux compteurs pour ce groupe (goût → quantité). */
  onCountsChange: (next: Record<string, number>) => void;
};

export function PortionComposer({ group, selections, onCountsChange }: Props) {
  const counts = (selections[group.name] as Record<string, number>) ?? {};
  const slots = portionSlots(group, selections);
  const size = portionCount(group);
  const chosen = slots.filter(Boolean).length;
  const isFull = chosen >= size;
  const nextEmptyIndex = slots.findIndex((s) => s === null);

  function addPortion(optionName: string) {
    onCountsChange({ ...counts, [optionName]: (counts[optionName] ?? 0) + 1 });
  }

  function removePortion(optionName: string) {
    const next = Math.max(0, (counts[optionName] ?? 0) - 1);
    onCountsChange({ ...counts, [optionName]: next });
  }

  return (
    <section
      aria-labelledby={`portions-${group.name}`}
      className="rounded-xl border border-foreground/10 p-3"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3
          id={`portions-${group.name}`}
          className="text-sm font-semibold text-foreground/80"
        >
          {stripPortionSuffix(group.name)}
        </h3>
        <span
          aria-live="polite"
          className={cn(
            'text-xs font-semibold tabular-nums',
            isFull ? 'text-success-600' : 'text-primary'
          )}
        >
          {chosen} / {size}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-foreground/50">
        {isFull
          ? 'Votre boîte est complète.'
          : `Appuyez sur un goût pour remplir les ${size} parts de la boîte.`}
      </p>

      {/* La boîte : une case par part, remplie ou libre. C'est le récapitulatif
          permanent — le client n'a jamais à compter. */}
      <ul className="mt-3 grid grid-cols-4 gap-1.5">
        {slots.map((optionName, index) => (
          <li key={index}>
            {optionName ? (
              <button
                type="button"
                onClick={() => removePortion(optionName)}
                aria-label={`Retirer ${optionName} de la part ${index + 1}`}
                className="group relative flex h-16 w-full cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg bg-primary/10 px-1 text-center transition-colors hover:bg-primary/15"
              >
                <span className="line-clamp-2 text-[11px] font-semibold leading-tight text-primary">
                  {optionName}
                </span>
                <X
                  className="size-3 text-primary/50 transition-colors group-hover:text-primary"
                  aria-hidden="true"
                />
              </button>
            ) : (
              <div
                aria-label={`Part ${index + 1} à choisir`}
                className={cn(
                  'flex h-16 w-full items-center justify-center rounded-lg border border-dashed',
                  index === nextEmptyIndex
                    ? 'border-primary/40 bg-primary/[0.03]'
                    : 'border-foreground/15'
                )}
              >
                <Plus
                  className={cn(
                    'size-4',
                    index === nextEmptyIndex
                      ? 'text-primary/50'
                      : 'text-foreground/20'
                  )}
                  aria-hidden="true"
                />
              </div>
            )}
          </li>
        ))}
      </ul>

      {/* Les goûts. Un appui remplit la case suivante — pas de compteur à
          manipuler, le décompte se lit dans la boîte au-dessus. */}
      <ul className="mt-3 grid grid-cols-2 gap-1.5">
        {group.options.map((opt) => {
          const taken = counts[opt.name] ?? 0;
          // Plafond du goût : son propre stock restant. La boîte pleine
          // bloque tout le reste.
          const optionCap = opt.remaining ?? Infinity;
          const isDisabled = opt.soldOut || isFull || taken >= optionCap;

          return (
            <li key={opt.name}>
              <Button
                fullWidth
                variant={taken > 0 ? 'flat' : 'bordered'}
                color={taken > 0 ? 'primary' : 'default'}
                size="sm"
                isDisabled={isDisabled}
                onPress={() => addPortion(opt.name)}
                aria-label={`Ajouter une part ${opt.name}`}
                className="h-auto min-h-11 cursor-pointer justify-between px-3 py-2 disabled:cursor-not-allowed"
              >
                <span className="truncate text-xs font-medium">
                  {opt.name}
                  {opt.soldOut && (
                    <span className="ml-1 text-[10px] font-semibold text-danger">
                      épuisé
                    </span>
                  )}
                </span>
                {taken > 0 && (
                  <span className="ml-1 shrink-0 rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                    {taken}
                  </span>
                )}
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
