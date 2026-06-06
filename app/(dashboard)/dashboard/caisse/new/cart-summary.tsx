'use client';

import { Minus, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { priceFormatter } from '@/config/menu';
import { getItemTotal, type CartItem } from '@/lib/cart-store';
import {
  getItemGross,
  getItemNet,
  getMaxItemDiscount,
} from '@/lib/orders/totals';
import { LineDiscountControl } from '../../_components/line-discount-control';

type Props = {
  items: CartItem[];
  onQuantityChange: (cartId: string, quantity: number) => void;
  onRemove: (cartId: string) => void;
  onDiscountChange: (
    cartId: string,
    discount: number,
    reason: string | null
  ) => void;
};

export function CartSummary({
  items,
  onQuantityChange,
  onRemove,
  onDiscountChange,
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
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {item.productName}
                  </p>
                  {item.supplements.length > 0 && (
                    <p className="truncate text-xs text-muted-foreground">
                      {item.supplements.map((s) => s.optionName).join(' · ')}
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
                <QuantityStepper
                  value={item.quantity}
                  onChange={(q) => onQuantityChange(item.cartId, q)}
                />
                <span className="w-16 shrink-0 text-right text-sm tabular-nums">
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
            </li>
          );
        })}
      </ul>
      <div className="flex items-center justify-between border-t px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Total
        </span>
        <span className="text-base font-bold tabular-nums">
          {priceFormatter.format(total)} F
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
