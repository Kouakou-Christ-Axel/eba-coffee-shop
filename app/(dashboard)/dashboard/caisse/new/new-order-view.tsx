'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ShoppingBag, Bike, Coffee } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { priceFormatter, type MenuCategory, type Product } from '@/config/menu';
import {
  getItemTotal,
  type CartItem,
  type CartItemSupplement,
} from '@/lib/cart-store';
import type { OrderType } from '@/generated/prisma/client';
import { ProductCatalog } from './product-catalog';
import { CartSummary } from './cart-summary';
import { SupplementPicker } from './supplement-picker';

type Step = 'catalog' | 'review';

const ORDER_TYPES: { value: OrderType; label: string; Icon: typeof Bike }[] = [
  { value: 'TAKEAWAY', label: 'À emporter', Icon: ShoppingBag },
  { value: 'DINE_IN', label: 'Sur place', Icon: Coffee },
  { value: 'DELIVERY', label: 'Livraison', Icon: Bike },
];

function makeCartId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function supplementsKey(supplements: CartItemSupplement[]): string {
  return JSON.stringify(
    supplements.map((s) => `${s.groupName}:${s.optionName}:${s.price}`).sort()
  );
}

export function NewOrderView({ menu }: { menu: MenuCategory[] }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('catalog');
  const [items, setItems] = useState<CartItem[]>([]);
  const [pickerProduct, setPickerProduct] = useState<Product | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderType, setOrderType] = useState<OrderType>('TAKEAWAY');
  const [note, setNote] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, startSubmit] = useTransition();

  const totalItems = useMemo(
    () => items.reduce((s, i) => s + i.quantity, 0),
    [items]
  );
  const totalPrice = useMemo(
    () => items.reduce((s, i) => s + getItemTotal(i), 0),
    [items]
  );

  function handleProductTap(product: Product) {
    const hasSupplements = (product.supplements?.length ?? 0) > 0;
    if (!hasSupplements) {
      addToCart(product, []);
      return;
    }
    setPickerProduct(product);
    setIsPickerOpen(true);
  }

  function addToCart(product: Product, supplements: CartItemSupplement[]) {
    setItems((prev) => {
      const key = supplementsKey(supplements);
      const existing = prev.find(
        (i) =>
          i.productId === product.id && supplementsKey(i.supplements) === key
      );
      if (existing) {
        return prev.map((i) =>
          i.cartId === existing.cartId ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      const item: CartItem = {
        cartId: makeCartId(),
        productId: product.id,
        productName: product.name,
        basePrice: product.price,
        quantity: 1,
        supplements,
      };
      return [...prev, item];
    });
  }

  function handleQuantityChange(cartId: string, quantity: number) {
    setItems((prev) =>
      quantity <= 0
        ? prev.filter((i) => i.cartId !== cartId)
        : prev.map((i) => (i.cartId === cartId ? { ...i, quantity } : i))
    );
  }

  function handleRemove(cartId: string) {
    setItems((prev) => prev.filter((i) => i.cartId !== cartId));
  }

  function handleSubmit() {
    if (items.length === 0) return;
    setSubmitError(null);
    startSubmit(async () => {
      try {
        const res = await fetch('/api/caisse/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items,
            total: totalPrice,
            customerName: customerName.trim() || null,
            customerPhone: customerPhone.trim() || null,
            orderType,
            note: note.trim() || null,
          }),
        });
        if (!res.ok) {
          let msg = `Erreur ${res.status}`;
          try {
            const data = (await res.json()) as { error?: string };
            if (typeof data.error === 'string') msg = data.error;
          } catch {
            // ignore
          }
          setSubmitError(msg);
          return;
        }
        router.push('/dashboard/caisse');
        router.refresh();
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : 'Erreur réseau');
      }
    });
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col gap-4 pb-24">
      {/* Header */}
      <header className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (step === 'review') {
              setStep('catalog');
            } else {
              router.push('/dashboard/caisse');
            }
          }}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-lg font-semibold">
          {step === 'catalog' ? 'Nouvelle commande' : 'Récapitulatif'}
        </h1>
      </header>

      {/* Body */}
      {step === 'catalog' ? (
        <ProductCatalog menu={menu} onProductTap={handleProductTap} />
      ) : (
        <div className="flex flex-col gap-4">
          <CartSummary
            items={items}
            onQuantityChange={handleQuantityChange}
            onRemove={handleRemove}
          />

          {/* Form client */}
          <div className="rounded-xl border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">Type de commande</h2>
            <div className="grid grid-cols-3 gap-2">
              {ORDER_TYPES.map(({ value, label, Icon }) => {
                const isActive = orderType === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setOrderType(value)}
                    className={cn(
                      'flex flex-col items-center justify-center gap-1 rounded-lg border-2 px-2 py-2.5 text-xs font-medium transition-colors',
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

            <div className="mt-4 grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="customer-name">
                  Prénom{' '}
                  <span className="text-muted-foreground">(optionnel)</span>
                </Label>
                <Input
                  id="customer-name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Client anonyme"
                  autoComplete="off"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="customer-phone">
                  Téléphone{' '}
                  <span className="text-muted-foreground">(optionnel)</span>
                </Label>
                <Input
                  id="customer-phone"
                  type="tel"
                  inputMode="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="07 88 12 34 56"
                  autoComplete="off"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="note">
                  Note{' '}
                  <span className="text-muted-foreground">(optionnel)</span>
                </Label>
                <Textarea
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Sans sucre, à emporter dans 5 min, etc."
                  rows={2}
                />
              </div>
            </div>
          </div>

          {submitError && (
            <p className="text-sm text-destructive">{submitError}</p>
          )}
        </div>
      )}

      {/* Sticky bottom CTA */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t bg-background p-3 shadow-lg">
        <div className="mx-auto max-w-3xl">
          {step === 'catalog' ? (
            <Button
              type="button"
              size="lg"
              className="w-full"
              disabled={items.length === 0}
              onClick={() => setStep('review')}
            >
              {items.length === 0
                ? 'Panier vide'
                : `Voir le panier · ${totalItems} article${totalItems > 1 ? 's' : ''} · ${priceFormatter.format(totalPrice)} F`}
            </Button>
          ) : (
            <Button
              type="button"
              size="lg"
              className="w-full"
              disabled={items.length === 0 || isSubmitting}
              onClick={handleSubmit}
            >
              {isSubmitting
                ? 'Création…'
                : `Valider la commande · ${priceFormatter.format(totalPrice)} F`}
            </Button>
          )}
        </div>
      </div>

      <SupplementPicker
        product={pickerProduct}
        isOpen={isPickerOpen}
        onClose={() => {
          setIsPickerOpen(false);
          setPickerProduct(null);
        }}
        onAdd={({ product, supplements }) => addToCart(product, supplements)}
      />
    </div>
  );
}
