'use client';

import { Checkbox } from '@heroui/react';
import { cn } from '@/lib/utils';
import { priceFormatter } from '@/config/menu';
import { multipleSelection } from '@/lib/supplements';
import { RestockControl } from '../../../_components/restock-control';
import type { Group, GroupCtx } from './types';

export function MultipleOptions({
  group,
  ctx,
}: {
  group: Group;
  ctx: GroupCtx;
}) {
  const {
    activeProduct,
    selections,
    forFutureDay,
    hasRestock,
    count,
    max,
    toggleMultiple,
    handleOptionRestocked,
  } = ctx;
  return (
    <>
      {group.type === 'multiple' && (
        <div className="space-y-2">
          {group.options.map((opt) => {
            const current = multipleSelection(selections, group.name);
            const isChecked = current.includes(opt.name);
            const isDisabled =
              (opt.soldOut && !forFutureDay) || (!isChecked && count >= max);
            return (
              <div key={opt.name} className="flex items-center gap-2">
                <Checkbox
                  isSelected={isChecked}
                  isDisabled={isDisabled}
                  onValueChange={() => toggleMultiple(group.name, opt.name)}
                  className="flex-1"
                >
                  <span className="flex items-center justify-between gap-4">
                    <span className="text-sm">
                      {opt.name}
                      {opt.soldOut && (
                        <span
                          className={cn(
                            'ml-1.5 text-xs font-medium',
                            forFutureDay ? 'text-warning' : 'text-danger'
                          )}
                        >
                          {forFutureDay ? 'épuisé aujourd’hui' : 'épuisé'}
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-foreground/50">
                      +{priceFormatter.format(opt.price)} F
                    </span>
                  </span>
                </Checkbox>
                {hasRestock && opt.stockQuantity != null && (
                  <RestockControl
                    compact
                    ariaLabel={`Réapprovisionner ${opt.name}`}
                    body={{
                      target: 'option',
                      productId: activeProduct.id,
                      groupName: group.name,
                      optionName: opt.name,
                    }}
                    currentStock={opt.remaining ?? opt.stockQuantity}
                    onDone={(stock) =>
                      handleOptionRestocked(group.name, opt.name, stock)
                    }
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
