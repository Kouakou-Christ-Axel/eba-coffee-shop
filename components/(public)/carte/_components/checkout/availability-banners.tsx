'use client';

import { Button } from '@heroui/react';
import { AlertTriangle } from 'lucide-react';
import type { CartItem } from '@/lib/cart-store';
import type { SoldOutLine } from '@/lib/schemas/order';

export function GoneItemsBanner({
  goneItems,
  onRemove,
}: {
  goneItems: CartItem[];
  onRemove: (cartId: string) => void;
}) {
  return (
    <div className="rounded-xl bg-danger-50 p-3 text-sm text-danger-700">
      <p className="flex items-center gap-2 font-medium">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
        {goneItems.length > 1
          ? 'Ces articles ne sont plus disponibles'
          : 'Cet article n’est plus disponible'}
      </p>
      <ul className="mt-1.5">
        {goneItems.map((item) => (
          <li
            key={item.cartId}
            className="flex items-center justify-between gap-2"
          >
            <span className="min-w-0 truncate">{item.productName}</span>
            <Button
              size="sm"
              variant="flat"
              color="danger"
              className="min-h-9"
              onPress={() => onRemove(item.cartId)}
            >
              Retirer
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PreSoldOutBanner({
  lines,
  onResolve,
}: {
  lines: SoldOutLine[];
  onResolve: (lines: SoldOutLine[]) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-warning-50 p-3 text-sm text-warning-700">
      <p className="flex min-w-0 items-center gap-2 font-medium">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
        {lines.length > 1
          ? `${lines.length} articles épuisés aujourd’hui`
          : `${lines[0].productName} : épuisé aujourd’hui`}
      </p>
      <Button
        size="sm"
        color="warning"
        className="min-h-9 shrink-0"
        onPress={() => onResolve(lines)}
      >
        Résoudre
      </Button>
    </div>
  );
}
