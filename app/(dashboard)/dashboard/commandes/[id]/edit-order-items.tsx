'use client';

import { useState, useTransition } from 'react';
import { Pencil, Trash2, Plus, Minus, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CartItem } from '@/lib/cart-store';
import type { OrderStatus } from '@/generated/prisma/client';
import { updateOrderItemsAction } from '../actions';

type Props = {
  orderId: string;
  initialItems: CartItem[];
  status: OrderStatus;
};

export function EditOrderItems({ orderId, initialItems, status }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [items, setItems] = useState<CartItem[]>(initialItems);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isLocked = status === 'COMPLETED' || status === 'CANCELLED';

  if (isLocked) return null;

  function changeQty(cartId: string, delta: number) {
    setItems((prev) =>
      prev
        .map((i) =>
          i.cartId === cartId ? { ...i, quantity: i.quantity + delta } : i
        )
        .filter((i) => i.quantity > 0)
    );
  }

  function removeItem(cartId: string) {
    setItems((prev) => prev.filter((i) => i.cartId !== cartId));
  }

  function cancel() {
    setItems(initialItems);
    setError(null);
    setIsEditing(false);
  }

  function save() {
    if (items.length === 0) {
      setError('La commande doit contenir au moins un article');
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await updateOrderItemsAction(orderId, items);
        setIsEditing(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur');
      }
    });
  }

  const fmt = new Intl.NumberFormat('fr-FR');

  if (!isEditing) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsEditing(true)}
        className="gap-1.5"
      >
        <Pencil className="size-3.5" />
        Modifier les articles
      </Button>
    );
  }

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span>Modifier les articles</span>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              onClick={save}
              disabled={isPending || items.length === 0}
              className="gap-1"
            >
              <Check className="size-3.5" /> Enregistrer
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={cancel}
              disabled={isPending}
              className="gap-1"
            >
              <X className="size-3.5" /> Annuler
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => {
          const lineTotal =
            (item.basePrice +
              item.supplements.reduce((s, sup) => s + sup.price, 0)) *
            item.quantity;
          return (
            <div key={item.cartId} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.productName}</p>
                {item.supplements.length > 0 && (
                  <p className="truncate text-xs text-muted-foreground">
                    {item.supplements.map((s) => s.optionName).join(', ')}
                  </p>
                )}
              </div>
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
              <span className="w-24 text-right text-sm">
                {fmt.format(lineTotal)} FCFA
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => removeItem(item.cartId)}
                disabled={isPending}
                aria-label="Supprimer"
              >
                <Trash2 className="size-3.5 text-destructive" />
              </Button>
            </div>
          );
        })}
        {items.length === 0 && (
          <p className="text-sm text-destructive">
            La commande doit contenir au moins un article.
          </p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="border-t pt-2 text-right text-sm font-bold">
          Total :{' '}
          {fmt.format(
            items.reduce(
              (sum, item) =>
                sum +
                (item.basePrice +
                  item.supplements.reduce((s, sup) => s + sup.price, 0)) *
                  item.quantity,
              0
            )
          )}{' '}
          FCFA
        </div>
      </CardContent>
    </Card>
  );
}
