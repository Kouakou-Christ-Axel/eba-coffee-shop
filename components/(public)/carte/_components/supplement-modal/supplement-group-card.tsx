'use client';

import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SupplementGroup } from '@/config/menu';
import {
  effectiveMax,
  groupConstraintLabel,
  groupSelectionCount,
  isFixedPortionGroup,
} from '@/lib/supplements';
import { PortionComposer } from '../portion-composer';
import { orderableFirst } from './helpers';
import {
  MultipleOptions,
  QuantityOptions,
  SingleOptions,
} from './option-lists';
import type { SupplementModalState } from './use-supplement-modal';

export function SupplementGroupCard({
  group,
  modal,
}: {
  group: SupplementGroup;
  modal: SupplementModalState;
}) {
  const { product, selections, setSelections, rules, openGroups, toggleGroup } =
    modal;

  if (isFixedPortionGroup(group)) {
    return (
      <PortionComposer
        group={group}
        selections={selections}
        combos={product.portionCombos}
        onCountsChange={(next) =>
          setSelections((prev) => ({ ...prev, [group.name]: next }))
        }
      />
    );
  }

  const constraint = groupConstraintLabel(group);
  const count = groupSelectionCount(group, selections, rules);
  const max = effectiveMax(group);
  const isOpen = openGroups[group.name] ?? false;
  const options = orderableFirst(group.options);

  return (
    <div className="rounded-xl border border-foreground/10">
      <button
        type="button"
        onClick={() => toggleGroup(group.name)}
        className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2.5 text-left"
      >
        <span className="text-sm font-semibold text-foreground/80">
          {group.name}
          {group.required && (
            <span className="ml-1 text-xs text-primary">(requis)</span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-xs text-foreground/50">
          {count > 0 && (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
              {count}
            </span>
          )}
          <ChevronDown
            className={cn(
              'size-4 transition-transform',
              isOpen && 'rotate-180'
            )}
          />
        </span>
      </button>

      {isOpen && (
        <div className="space-y-2 px-3 pb-3">
          {constraint && (
            <p className="text-xs font-normal text-foreground/50">
              {constraint}
            </p>
          )}

          {group.type === 'single' && (
            <SingleOptions group={group} options={options} modal={modal} />
          )}

          {group.type === 'multiple' && (
            <MultipleOptions
              group={group}
              options={options}
              count={count}
              max={max}
              modal={modal}
            />
          )}

          {group.type === 'quantity' && (
            <QuantityOptions
              group={group}
              options={options}
              count={count}
              max={max}
              modal={modal}
            />
          )}
        </div>
      )}
    </div>
  );
}
