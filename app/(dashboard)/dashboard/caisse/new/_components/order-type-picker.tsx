'use client';

import { Bike, Coffee, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OrderType } from '@/generated/prisma/client';

const ORDER_TYPES: { value: OrderType; label: string; Icon: typeof Bike }[] = [
  { value: 'TAKEAWAY', label: 'À emporter', Icon: ShoppingBag },
  { value: 'DINE_IN', label: 'Sur place', Icon: Coffee },
  { value: 'DELIVERY', label: 'Livraison', Icon: Bike },
];

type Props = {
  value: OrderType;
  onChange: (value: OrderType) => void;
};

export function OrderTypePicker({ value, onChange }: Props) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Type de commande
      </p>
      <div className="grid grid-cols-3 gap-2">
        {ORDER_TYPES.map(({ value: v, label, Icon }) => {
          const isActive = value === v;
          return (
            <button
              key={v}
              type="button"
              onClick={() => onChange(v)}
              className={cn(
                'flex flex-col items-center justify-center gap-1 rounded-lg border-2 px-2 py-2 text-xs font-medium transition-colors',
                isActive
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card hover:bg-muted'
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={1.75} />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
