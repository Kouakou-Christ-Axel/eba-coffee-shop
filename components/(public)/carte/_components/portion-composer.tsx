'use client';

// components/(public)/carte/_components/portion-composer.tsx
//
// Composition d'une boîte à parts fixes (« Sponge Cake x4 », « Boîte de
// Brownies x8 »…). Le nombre de parts vient de la CONFIG du produit, jamais
// d'une constante : le composant doit rester bon à 3 parts comme à 12.
//
// Quatre principes tirés de ce que coûte chaque geste :
//
//  1. Pleine largeur, sans cadre. C'est le choix structurant du produit, pas
//     une option accessoire : il occupe la largeur de la feuille et se sépare
//     du reste par un filet, comme les sections d'Uber Eats.
//
//  2. La boîte se lit comme une BARRE, un segment par goût, de largeur
//     proportionnelle au nombre de parts. Une case par part semblait plus
//     littéral mais ne passe pas l'échelle : à 8 parts on obtient des rangées
//     bancales ou des jetons illisibles. L'ordre des parts n'est pas une
//     information — « Oreo ×4 | Chocolat noir ×4 » l'est.
//
//  3. Le multi-clic ne s'explique pas, il se montre. Dès qu'un goût passe à 1,
//     sa tuile devient un « − n + » : l'affordance remplace la notice, et à 8
//     parts on n'appuie plus 8 fois.
//
//  4. Remplir une grande boîte geste par geste reste coûteux quoi qu'on fasse.
//     Les répartitions déjà choisies par d'autres clients (`portionCombos`) la
//     remplissent en UN appui — le seul vrai remède quand N grandit.

import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '@heroui/react';
import { Check, Minus, Plus, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PortionCombo, SupplementGroup } from '@/config/menu';
import {
  portionCount,
  portionSlots,
  stripPortionSuffix,
  type Selections,
} from '@/lib/supplements';
import { isComboAvailable } from '@/lib/portion-combos';

type Props = {
  group: SupplementGroup;
  selections: Selections;
  /** Répartitions populaires du produit, tous groupes confondus. */
  combos?: PortionCombo[];
  /** Applique de nouveaux compteurs pour ce groupe (goût → quantité). */
  onCountsChange: (next: Record<string, number>) => void;
};

/** « Oreo ×2 · Coco ×1 » — lecture compacte d'une répartition. */
function comboLabel(combo: PortionCombo): string {
  return Object.entries(combo.counts)
    .filter(([, qty]) => qty > 0)
    .map(([name, qty]) => (qty > 1 ? `${name} ×${qty}` : name))
    .join(' · ');
}

/** Segments de la barre : un par goût retenu, avec son nombre de parts. */
function portionRuns(
  slots: (string | null)[]
): { optionName: string; count: number }[] {
  const runs = new Map<string, number>();
  for (const name of slots) {
    if (name) runs.set(name, (runs.get(name) ?? 0) + 1);
  }
  return [...runs.entries()].map(([optionName, count]) => ({
    optionName,
    count,
  }));
}

export function PortionComposer({
  group,
  selections,
  combos = [],
  onCountsChange,
}: Props) {
  const reduceMotion = useReducedMotion();
  const counts = (selections[group.name] as Record<string, number>) ?? {};
  const slots = portionSlots(group, selections);
  const size = portionCount(group);
  const chosen = slots.filter(Boolean).length;
  const free = size - chosen;
  const isFull = free <= 0;
  const runs = portionRuns(slots);

  // Répartitions applicables ici : celles de CE groupe dont tous les goûts sont
  // encore disponibles en quantité suffisante.
  const usableCombos = combos.filter(
    (c) => c.groupName === group.name && isComboAvailable(c, group)
  );

  function setCount(optionName: string, next: number) {
    onCountsChange({ ...counts, [optionName]: Math.max(0, next) });
  }

  return (
    <section
      aria-labelledby={`portions-${group.name}`}
      className="border-t border-foreground/10 pt-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3
          id={`portions-${group.name}`}
          className="text-base font-semibold text-foreground"
        >
          {stripPortionSuffix(group.name)}
        </h3>
        <span
          aria-live="polite"
          className={cn(
            'shrink-0 rounded-full px-2.5 py-1 text-sm font-bold tabular-nums transition-colors',
            isFull
              ? 'bg-success/15 text-success-700'
              : 'bg-primary/10 text-primary'
          )}
        >
          {chosen} / {size}
        </span>
      </div>
      <p className="mt-1 text-sm text-foreground/55">
        {isFull
          ? 'Votre boîte est complète.'
          : 'Appuyez sur un goût, plusieurs fois pour en répéter un.'}
      </p>

      {/* La boîte vue du dessus : chaque goût occupe la place de ses parts. */}
      <div className="mt-3 flex h-10 w-full gap-1 overflow-hidden">
        {runs.map((run) => (
          <motion.button
            key={run.optionName}
            type="button"
            // Retour visuel de l'appui : le segment s'étend jusqu'à sa nouvelle
            // largeur, pour lier la cause et l'effet sans ambiguïté.
            layout={!reduceMotion}
            initial={reduceMotion ? false : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { type: 'spring', stiffness: 420, damping: 32 }
            }
            style={{ flexGrow: run.count, flexBasis: 0 }}
            onClick={() => setCount(run.optionName, run.count - 1)}
            // Libellé distinct de celui du stepper : les deux retirent une
            // part, mais deux boutons au même nom accessible sont
            // indistinguables au lecteur d'écran.
            aria-label={`${run.optionName} : ${run.count} part${run.count > 1 ? 's' : ''} dans la boîte, retirer`}
            title={`${run.optionName} — ${run.count} part${run.count > 1 ? 's' : ''}`}
            className="flex min-w-0 cursor-pointer items-center justify-center gap-1 rounded-lg bg-primary px-2 text-primary-foreground transition-opacity hover:opacity-85"
          >
            <span className="truncate text-xs font-semibold">
              {run.optionName}
            </span>
            <span className="shrink-0 text-xs font-bold tabular-nums opacity-75">
              ×{run.count}
            </span>
          </motion.button>
        ))}

        {free > 0 && (
          <motion.div
            layout={!reduceMotion}
            style={{ flexGrow: free, flexBasis: 0 }}
            aria-label={`${free} part${free > 1 ? 's' : ''} libre${free > 1 ? 's' : ''}`}
            className="flex min-w-0 items-center justify-center rounded-lg border border-dashed border-foreground/20 bg-foreground/[0.02]"
          >
            {/* Le libellé complet ne tient que tant que le reste est large :
                dès qu'un goût est choisi, le segment rétrécit et « 2 parts
                libres » se ferait tronquer en « 2 parts … ». On tombe alors
                sur le seul chiffre, qui reste juste et lisible. */}
            <span className="truncate px-2 text-xs font-medium text-foreground/40">
              {free === size
                ? `${free} part${free > 1 ? 's' : ''} libre${free > 1 ? 's' : ''}`
                : free}
            </span>
          </motion.div>
        )}
      </div>

      {/* Un appui suffit à remplir toute la boîte — décisif dès que N grandit,
          et c'est de la preuve sociale au moment exact du choix. */}
      {usableCombos.length > 0 && !isFull && (
        <div className="mt-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground/70">
            <Users className="size-4" aria-hidden="true" />
            Les plus prises
          </p>
          <ul className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none">
            {usableCombos.map((combo) => (
              <li key={comboLabel(combo)} className="shrink-0">
                <button
                  type="button"
                  onClick={() => onCountsChange({ ...combo.counts })}
                  className="flex cursor-pointer flex-col items-start gap-0.5 rounded-xl border border-primary/25 bg-primary/[0.04] px-3.5 py-2.5 text-left transition-colors hover:bg-primary/10"
                >
                  <span className="text-sm font-semibold text-foreground">
                    {comboLabel(combo)}
                  </span>
                  <span className="text-xs text-foreground/55">
                    choisie {combo.orders} fois
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Les goûts. Tant qu'un goût n'est pas pris, une tuile simple ; dès qu'il
          l'est, elle devient un stepper — c'est ce qui rend le multi-clic
          évident et rend une boîte de 8 tenable. */}
      <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {group.options.map((opt) => {
          const taken = counts[opt.name] ?? 0;
          // Plafond du goût : son propre stock restant. La boîte pleine bloque
          // tout ajout supplémentaire.
          const optionCap = opt.remaining ?? Infinity;
          const canAdd = !opt.soldOut && !isFull && taken < optionCap;

          if (taken > 0) {
            return (
              <li
                key={opt.name}
                className="rounded-xl border border-primary bg-primary/[0.06] px-2 py-2"
              >
                {/* Le nom occupe toute la largeur de la tuile : en le coinçant
                    entre les deux boutons, « Chocolat noir » se tronquait. */}
                <p className="line-clamp-2 text-center text-sm font-semibold leading-tight text-foreground">
                  {opt.name}
                </p>
                <div className="mt-1.5 flex items-center justify-between gap-1">
                  <Button
                    isIconOnly
                    size="sm"
                    radius="full"
                    variant="light"
                    aria-label={`Retirer une part ${opt.name}`}
                    onPress={() => setCount(opt.name, taken - 1)}
                    className="min-h-8 min-w-8 shrink-0 cursor-pointer text-primary"
                  >
                    <Minus className="size-4" />
                  </Button>
                  <span className="text-base font-bold tabular-nums text-primary">
                    {taken}
                  </span>
                  <Button
                    isIconOnly
                    size="sm"
                    radius="full"
                    variant="light"
                    isDisabled={!canAdd}
                    aria-label={`Ajouter une part ${opt.name}`}
                    onPress={() => setCount(opt.name, taken + 1)}
                    className="min-h-8 min-w-8 shrink-0 cursor-pointer text-primary disabled:opacity-30"
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
              </li>
            );
          }

          return (
            <li key={opt.name}>
              <Button
                fullWidth
                variant="bordered"
                isDisabled={!canAdd}
                onPress={() => setCount(opt.name, 1)}
                aria-label={`Ajouter une part ${opt.name}`}
                className="h-auto min-h-14 cursor-pointer px-2 py-2 disabled:cursor-not-allowed"
              >
                <span className="line-clamp-2 text-sm font-medium leading-tight">
                  {opt.name}
                  {opt.soldOut && (
                    <span className="ml-1 font-semibold text-danger">
                      épuisé
                    </span>
                  )}
                </span>
              </Button>
            </li>
          );
        })}
      </ul>

      {isFull && (
        <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-success-700">
          <Check className="size-4" aria-hidden="true" />
          Boîte complète — appuyez sur un goût pour l’ajuster.
        </p>
      )}
    </section>
  );
}
