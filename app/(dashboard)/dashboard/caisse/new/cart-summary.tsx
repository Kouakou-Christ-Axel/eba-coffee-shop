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
        {items.map((item) => (
          <li key={item.cartId} className="px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium">
                  {item.productName}
                </p>
                {item.supplements.length > 0 && (
                  <p className="truncate text-xs text-muted-foreground">
                    {item.supplements.map((s) => s.optionName).join(' · ')}
                  </p>
                )}
              </div>
              <QuantityStepper
                value={item.quantity}
                onChange={(q) => onQuantityChange(item.cartId, q)}
              />
              <span className="w-16 shrink-0 text-right text-sm font-semibold tabular-nums">
                {priceFormatter.format(getItemTotal(item))}
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
        ))}
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
