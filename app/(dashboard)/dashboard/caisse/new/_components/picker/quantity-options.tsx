'use client';

import { Button } from '@heroui/react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { priceFormatter } from '@/config/menu';
import { optionQuantity } from '@/lib/supplements';
import { RestockControl } from '../../../_components/restock-control';
import type { Group, GroupCtx } from './types';

export function QuantityOptions({
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
    setQuantity,
    handleOptionRestocked,
  } = ctx;
  return (
    <>
      {group.type === 'quantity' && (
        <div className="space-y-2">
          {group.options.map((opt) => {
            const qty = optionQuantity(group, selections, opt.name);
            // Plafond : la plus stricte entre la borne du groupe et le stock restant de l'option (sinon « N / N » avec une option
            // épuisée encore incrémentable). Pour un retrait ultérieur, le stock du jour ne plafonne rien.
            const optionCap = forFutureDay
              ? Infinity
              : (opt.remaining ?? Infinity);
            const canIncrement =
              (!opt.soldOut || forFutureDay) && count < max && qty < optionCap;
            return (
              <div
                key={opt.name}
                className="flex items-center justify-between gap-4"
              >
                <span className="text-sm">
                  {opt.name}
                  {opt.price > 0 && (
                    <span className="ml-1 text-xs text-foreground/50">
                      +{priceFormatter.format(opt.price)} F
                    </span>
                  )}
                  {opt.soldOut ? (
                    <span
                      className={cn(
                        'ml-1.5 text-xs font-medium',
                        forFutureDay ? 'text-warning' : 'text-danger'
                      )}
                    >
                      {forFutureDay ? 'épuisé aujourd’hui' : 'épuisé'}
                    </span>
                  ) : (
                    opt.remaining != null && (
                      <span className="ml-1.5 text-xs text-foreground/40">
                        reste {opt.remaining}
                      </span>
                    )
                  )}
                </span>
                <div className="flex items-center gap-2">
                  {hasRestock && opt.stockQuantity != null && (
                    <RestockControl
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
                  <Button
                    isIconOnly
                    size="sm"
                    variant="flat"
                    isDisabled={qty === 0}
                    aria-label={`Retirer ${opt.name}`}
                    onPress={() => setQuantity(group.name, opt.name, -1)}
                  >
                    <Minus className="size-3.5" />
                  </Button>
                  <span className="w-5 text-center text-sm font-medium">
                    {qty}
                  </span>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="flat"
                    isDisabled={!canIncrement}
                    aria-label={`Ajouter ${opt.name}`}
                    onPress={() => setQuantity(group.name, opt.name, 1)}
                  >
                    <Plus className="size-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
          {Number.isFinite(max) && (
            <p className="text-right text-xs text-foreground/50">
              {count} / {max} sélectionné(s)
            </p>
          )}
        </div>
      )}
    </>
  );
}
