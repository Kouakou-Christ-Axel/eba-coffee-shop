'use client';

import { Minus, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { priceFormatter } from '@/config/menu';
import { getItemTotal, type CartItem } from '@/lib/cart-store';

type Props = {
  items: CartItem[];
  onQuantityChange: (cartId: string, quantity: number) => void;
  onRemove: (cartId: string) => void;
};

export function CartSummary({ items, onQuantityChange, onRemove }: Props) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
        Aucun article dans la commande.
      </div>
    );
  }

  return (
    <ul className="divide-y rounded-xl border bg-card">
      {items.map((item) => (
        <li key={item.cartId} className="p-3">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-tight">
                {item.productName}
              </p>
              {item.supplements.length > 0 && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {item.supplements
                    .map(
                      (s) =>
                        `${s.optionName}${s.price > 0 ? ` +${priceFormatter.format(s.price)}` : ''}`
                    )
                    .join(' · ')}
                </p>
              )}
              <p className="mt-1 text-sm font-semibold tabular-nums">
                {priceFormatter.format(getItemTotal(item))} F
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <button
                type="button"
                onClick={() => onRemove(item.cartId)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                aria-label="Supprimer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <QuantityStepper
                value={item.quantity}
                onChange={(q) => onQuantityChange(item.cartId, q)}
              />
            </div>
          </div>
        </li>
      ))}
    </ul>
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
    <div className="inline-flex items-center gap-0.5 rounded-lg border bg-background">
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-l-lg transition-colors',
          'hover:bg-muted'
        )}
        aria-label="Diminuer"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="min-w-7 text-center text-sm font-medium tabular-nums">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="flex h-8 w-8 items-center justify-center rounded-r-lg transition-colors hover:bg-muted"
        aria-label="Augmenter"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
