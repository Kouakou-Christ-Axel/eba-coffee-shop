'use client';

import { RadioGroup, Radio } from '@heroui/react';
import { cn } from '@/lib/utils';
import { priceFormatter } from '@/config/menu';
import { RestockControl } from '../../../_components/restock-control';
import type { Group, GroupCtx } from './types';

export function SingleOptions({ group, ctx }: { group: Group; ctx: GroupCtx }) {
  const {
    activeProduct,
    selections,
    forFutureDay,
    hasRestock,
    setSingle,
    handleOptionRestocked,
  } = ctx;
  return (
    <>
      {group.type === 'single' && (
        <RadioGroup
          value={(selections[group.name] as string) ?? ''}
          onValueChange={(v) => setSingle(group.name, v)}
        >
          {/* Désélection des groupes facultatifs : retour à « aucun choix ». */}
          {!group.required && (
            <Radio value="">
              <span className="text-sm text-foreground/60">Aucun</span>
            </Radio>
          )}
          {group.options.map((opt) => (
            <div key={opt.name} className="flex items-center gap-2">
              <Radio
                value={opt.name}
                isDisabled={opt.soldOut && !forFutureDay}
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
                    {opt.price === 0
                      ? 'Inclus'
                      : `+${priceFormatter.format(opt.price)} F`}
                  </span>
                </span>
              </Radio>
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
          ))}
        </RadioGroup>
      )}
    </>
  );
}
