'use client';

import { Copy, Minus, Plus, SlidersHorizontal, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type CartItem } from '@/lib/cart-store';
import {
  getItemGross,
  getItemNet,
  getMaxItemDiscount,
} from '@/lib/orders/totals';
import { formatSupplementsSummary } from '@/lib/orders/format';
import { productHasOptions } from '@/lib/catalog';
import { LineDiscountControl } from '../line-discount-control';
import { fmt } from './helpers';
import type { OrderItemsEditorState } from './use-order-items-editor';

export function OrderItemRow({
  item,
  editor,
}: {
  item: CartItem;
  editor: OrderItemsEditorState;
}) {
  const {
    isPending,
    productById,
    changeQty,
    removeItem,
    setItemDiscount,
    editLineOptions,
    duplicateLineWithOptions,
  } = editor;
  const lineProduct = productById.get(item.productId);
  const hasOptions =
    lineProduct !== undefined && productHasOptions(lineProduct);
  const gross = getItemGross(item);
  const net = getItemNet(item);
  const discounted = gross !== net;
  return (
    <div key={item.cartId} className="flex items-start gap-2">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <span className="truncate">{item.productName}</span>
          {item.addedLater && (
            <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
              Ajout
            </span>
          )}
        </p>
        {item.supplements.length > 0 && (
          <p className="truncate text-xs text-muted-foreground">
            {formatSupplementsSummary(item.supplements)}
          </p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <LineDiscountControl
            maxDiscount={getMaxItemDiscount(item)}
            discount={item.discount ?? 0}
            reason={item.discountReason ?? null}
            onChange={(d, r) => setItemDiscount(item.cartId, d, r)}
            disabled={isPending}
          />
          {hasOptions && (
            <button
              type="button"
              onClick={() => editLineOptions(item)}
              disabled={isPending}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
            >
              <SlidersHorizontal className="size-3.5" /> Options
            </button>
          )}
          {hasOptions && (
            <button
              type="button"
              onClick={() => duplicateLineWithOptions(item)}
              disabled={isPending}
              title="Ajouter un exemplaire avec des suppléments différents"
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
            >
              <Copy className="size-3.5" /> Dupliquer
            </button>
          )}
        </div>
        {item.discountReason && (
          <p className="mt-0.5 text-[11px] italic text-muted-foreground">
            Motif : {item.discountReason}
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => changeQty(item.cartId, -1)}
            disabled={isPending}
          >
            {item.quantity === 1 ? (
              <Trash2 className="size-3.5 text-destructive" />
            ) : (
              <Minus className="size-3.5" />
            )}
          </Button>
          <span className="w-6 text-center text-sm font-medium">
            {item.quantity}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => changeQty(item.cartId, 1)}
            disabled={isPending}
          >
            <Plus className="size-3.5" />
          </Button>
        </div>
        <span className="text-right text-sm">
          {discounted && (
            <span className="mr-1 text-xs text-muted-foreground line-through">
              {fmt.format(gross)}
            </span>
          )}
          <span
            className={
              discounted
                ? 'font-semibold text-green-700 dark:text-green-400'
                : ''
            }
          >
            {fmt.format(net)} F
          </span>
        </span>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => removeItem(item.cartId)}
        disabled={isPending}
        aria-label="Supprimer"
        className="mt-0.5"
      >
        <Trash2 className="size-3.5 text-destructive" />
      </Button>
    </div>
  );
}
