'use client';

import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  effectiveMax,
  groupConstraintLabel,
  groupSelectionCount,
} from '@/lib/supplements';
import { SupplementKindBadge } from '@/components/supplement-kind-badge';
import type { Group, GroupCtx, PickerCtx } from './types';
import { SingleOptions } from './single-options';
import { MultipleOptions } from './multiple-options';
import { QuantityOptions } from './quantity-options';

export function SupplementGroupCard({
  group,
  ctx,
  isOpen,
  onToggle,
}: {
  group: Group;
  ctx: PickerCtx;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const { selections, rules } = ctx;
  const constraint = groupConstraintLabel(group);
  const count = groupSelectionCount(group, selections, rules);
  const max = effectiveMax(group);

  const groupCtx: GroupCtx = { ...ctx, count, max };

  return (
    <div className="rounded-lg border border-foreground/10">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
      >
        <span className="text-sm font-semibold text-foreground/80">
          {group.name}
          <SupplementKindBadge kind={group.kind} />
          {group.required && (
            <span className="ml-1 text-xs text-primary">(requis)</span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
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
          <SingleOptions group={group} ctx={groupCtx} />
          <MultipleOptions group={group} ctx={groupCtx} />
          <QuantityOptions group={group} ctx={groupCtx} />
        </div>
      )}
    </div>
  );
}
