'use client';

// Une référence à compter.
//
// Trois décisions d'ergonomie portent cet écran, toutes dictées par le fait
// qu'on compte debout, au téléphone, dans la réserve :
//
//   1. **Pas de bouton « Conforme ».** Un bouton qui recopie le stock système en
//      un mot transforme l'inventaire physique en clic de validation — or toute
//      la valeur d'un comptage tient à ce que quelqu'un ait REGARDÉ l'étagère.
//      Un écart de 0 obtenu sans compter est pire qu'une ligne vide : il est
//      indiscernable d'un vrai comptage dans `InventoryCountLine`, qui fige la
//      période pour toujours. Les raccourcis portent donc des NOMBRES (12, 11,
//      13, 0) : le coût reste d'un appui, mais il faut lire la valeur et la
//      comparer au rayon. C'est le principe des « plus prises » de
//      `carte/_components/portion-composer.tsx`, appliqué ici.
//   2. **Le champ n'est jamais prérempli.** Vide ≠ 0 : vide veut dire « pas
//      encore comptée, stock inchangé », 0 veut dire « rayon vide ».
//   3. **Une carte comptée se replie mais ne bouge pas.** La liste ne se
//      réordonne jamais sous le pouce — une ligne qui saute juste après un appui
//      fait perdre le fil du rayon.

import { Minus, Plus, TriangleAlert } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { InventoryItemView } from '@/lib/inventory';

const f = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 });

/** Raccourcis proposés : le stock système, ses deux voisins, et zéro. */
export function suggestionsFor(system: number): number[] {
  const candidates = [system, system - 1, system + 1, 0];
  const seen = new Set<number>();
  const out: number[] = [];
  for (const value of candidates) {
    if (value < 0 || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

type Props = {
  item: InventoryItemView;
  raw: string;
  counted: number | null;
  /** Le stock système a bougé depuis la saisie (réappro passé entre-temps). */
  moved: boolean;
  onChange: (raw: string) => void;
  inputRef: (el: HTMLInputElement | null) => void;
  onEnter: () => void;
};

export function CountCard({
  item,
  raw,
  counted,
  moved,
  onChange,
  inputRef,
  onEnter,
}: Props) {
  const done = counted !== null;
  const delta = done ? counted - item.currentQuantity : 0;
  // `currentQuantity` vaut exactement « dernier comptage + achats non annulés
  // depuis » : c'est l'inventaire PÉRIODIQUE, rien d'autre n'y touche. Trouver
  // plus que ça en rayon ne peut donc pas être une consommation négative —
  // c'est une entrée qui n'a pas été enregistrée.
  const surplus = done && delta > 0;

  return (
    <div
      className={cn(
        'rounded-xl border bg-card transition-colors',
        done && 'border-border/60 bg-muted/30',
        surplus && 'border-amber-400 bg-amber-50 dark:bg-amber-950/20'
      )}
    >
      <div className="flex items-center gap-3 p-3 pb-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-medium">{item.name}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            <span className="font-mono">{item.sku}</span>
            <span aria-hidden> · </span>
            Système {f.format(item.currentQuantity)} {item.unit}
          </p>
        </div>

        <div className="inline-flex shrink-0 items-center rounded-md border bg-background">
          <button
            type="button"
            onClick={() => onChange(String(Math.max(0, (counted ?? 0) - 1)))}
            disabled={counted !== null && counted <= 0}
            className="flex h-11 w-10 items-center justify-center rounded-l-md transition-colors hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent"
            aria-label={`Diminuer la quantité comptée pour ${item.name}`}
          >
            <Minus className="size-4" />
          </button>
          <input
            ref={inputRef}
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={raw}
            placeholder="—"
            onChange={(e) => onChange(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onEnter();
              }
            }}
            className="h-11 w-16 border-x bg-transparent text-center text-lg font-semibold tabular-nums outline-none focus-visible:bg-muted/50"
            aria-label={`Quantité comptée pour ${item.name}`}
          />
          <button
            type="button"
            onClick={() => onChange(String((counted ?? 0) + 1))}
            className="flex h-11 w-10 items-center justify-center rounded-r-md transition-colors hover:bg-muted"
            aria-label={`Augmenter la quantité comptée pour ${item.name}`}
          >
            <Plus className="size-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1.5 px-3 pb-3">
        {/* Raccourcis chiffrés : même coût qu'un bouton « Conforme » (un appui),
            mais il faut lire la valeur pour la choisir. */}
        {suggestionsFor(item.currentQuantity).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onChange(String(value))}
            aria-pressed={counted === value}
            className={cn(
              'h-9 min-w-11 flex-1 rounded-md border text-sm font-medium tabular-nums transition-colors hover:bg-muted',
              counted === value && 'border-primary bg-primary/10 text-primary'
            )}
          >
            {f.format(value)}
          </button>
        ))}

        {done && (
          <span
            className={cn(
              'ml-1 w-12 shrink-0 text-right text-sm font-semibold tabular-nums',
              delta === 0 && 'text-muted-foreground',
              delta > 0 && 'text-green-600 dark:text-green-400',
              delta < 0 && 'text-destructive'
            )}
          >
            {delta > 0 ? `+${f.format(delta)}` : f.format(delta)}
          </span>
        )}
      </div>

      {surplus && (
        <p className="flex items-start gap-1.5 border-t border-amber-400/50 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Plus que le stock théorique — un achat n&apos;a peut-être pas été
            enregistré.
          </span>
        </p>
      )}

      {moved && (
        <p className="border-t px-3 py-2 text-xs text-muted-foreground">
          Le stock système a changé depuis votre saisie (réappro enregistré
          entre-temps). Votre comptage reste valable.
        </p>
      )}
    </div>
  );
}
