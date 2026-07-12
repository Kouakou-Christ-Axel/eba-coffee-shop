'use client';

import { Gift, Minus, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { priceFormatter } from '@/config/menu';
import { getItemTotal, type CartItem } from '@/lib/cart-store';
import {
  getItemGross,
  getItemNet,
  getMaxItemDiscount,
} from '@/lib/orders/totals';
import { formatSupplementLabel } from '@/lib/orders/format';
import { LineDiscountControl } from '../../_components/line-discount-control';
import type { LoyaltyCard } from '@/lib/hooks/use-new-order';

type Props = {
  items: CartItem[];
  onQuantityChange: (cartId: string, quantity: number) => void;
  onRemove: (cartId: string) => void;
  onDiscountChange: (
    cartId: string,
    discount: number,
    reason: string | null
  ) => void;
  loyaltyCard: LoyaltyCard | null;
  loyaltyRewardId: string | null;
  onLoyaltyRewardChange: (rewardId: string | null) => void;
};

export function CartSummary({
  items,
  onQuantityChange,
  onRemove,
  onDiscountChange,
  loyaltyCard,
  loyaltyRewardId,
  onLoyaltyRewardChange,
}: Props) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
        Aucun article dans la commande.
      </div>
    );
  }

  const total = items.reduce((s, i) => s + getItemTotal(i), 0);
  const count = items.reduce((s, i) => s + i.quantity, 0);

  const availableRewards = loyaltyCard?.availableRewards ?? [];
  const selectedReward =
    availableRewards.find((r) => r.id === loyaltyRewardId) ?? null;
  const loyaltyDiscount = selectedReward
    ? Math.min(selectedReward.capAmount, total)
    : 0;

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Panier
        </p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {count} article{count > 1 ? 's' : ''}
        </p>
      </div>
      <ul className="divide-y">
        {items.map((item) => {
          const gross = getItemGross(item);
          const net = getItemNet(item);
          const discounted = gross !== net;
          return (
            <li key={item.cartId} className="px-3 py-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {item.productName}
                  </p>
                  {item.supplements.length > 0 && (
                    <p className="truncate text-xs text-muted-foreground">
                      {item.supplements.map(formatSupplementLabel).join(' · ')}
                    </p>
                  )}
                  <div className="mt-1">
                    <LineDiscountControl
                      maxDiscount={getMaxItemDiscount(item)}
                      discount={item.discount ?? 0}
                      reason={item.discountReason ?? null}
                      onChange={(d, r) => onDiscountChange(item.cartId, d, r)}
                    />
                  </div>
                  {item.discountReason && (
                    <p className="mt-0.5 text-[11px] italic text-muted-foreground">
                      Motif : {item.discountReason}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 sm:items-start">
                  <QuantityStepper
                    value={item.quantity}
                    onChange={(q) => onQuantityChange(item.cartId, q)}
                  />
                  <span className="ml-auto w-16 shrink-0 text-right text-sm tabular-nums sm:ml-0">
                    {discounted && (
                      <span className="block text-xs text-muted-foreground line-through">
                        {priceFormatter.format(gross)}
                      </span>
                    )}
                    <span
                      className={cn(
                        'font-semibold',
                        discounted && 'text-green-700 dark:text-green-400'
                      )}
                    >
                      {priceFormatter.format(net)}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemove(item.cartId)}
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                    aria-label="Supprimer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {availableRewards.length > 0 && (
        <div className="border-t bg-amber-50 px-3 py-2 dark:bg-amber-950/30">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-amber-900 dark:text-amber-100">
            <Gift className="h-3.5 w-3.5" />
            Récompense fidélité disponible
          </p>
          <div className="flex flex-wrap gap-1.5">
            {availableRewards.map((r) => {
              const active = r.id === loyaltyRewardId;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onLoyaltyRewardChange(active ? null : r.id)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                    active
                      ? 'border-amber-600 bg-amber-600 text-white'
                      : 'border-amber-300 bg-white text-amber-900 hover:bg-amber-100 dark:bg-transparent dark:text-amber-100'
                  )}
                >
                  {active ? '✓ ' : ''}-{priceFormatter.format(r.capAmount)} F
                </button>
              );
            })}
          </div>
        </div>
      )}

      {loyaltyDiscount > 0 && (
        <div className="flex items-center justify-between border-t px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          <span>Récompense fidélité</span>
          <span className="tabular-nums">
            -{priceFormatter.format(loyaltyDiscount)} F
          </span>
        </div>
      )}

      <div className="flex items-center justify-between border-t px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Total
        </span>
        <span className="text-base font-bold tabular-nums">
          {priceFormatter.format(total - loyaltyDiscount)} F
        </span>
      </div>
    </div>
  );
}

function QuantityStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="inline-flex shrink-0 items-center rounded-md border bg-background">
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-l-md transition-colors',
          'hover:bg-muted'
        )}
        aria-label="Diminuer"
      >
        <Minus className="h-3 w-3" />
      </button>
      <span className="min-w-6 text-center text-xs font-medium tabular-nums">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="flex h-7 w-7 items-center justify-center rounded-r-md transition-colors hover:bg-muted"
        aria-label="Augmenter"
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
}
