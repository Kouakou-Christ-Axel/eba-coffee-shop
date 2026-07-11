'use client';

// components/(public)/carte/checkout-page.tsx
//
// Contenu client de /carte/commande : récapitulatif compact du panier +
// CheckoutForm, en page plein écran plutôt qu'en modal.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { useCartStore, getItemTotal } from '@/lib/cart-store';
import { priceFormatter } from '@/config/menu';
import { formatSupplementLabel } from '@/lib/orders/format';
import { useLoyaltyInfo } from '@/lib/hooks/use-loyalty-info';
import { CheckoutForm } from './checkout-form';

export function CheckoutPage() {
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const clearCart = useCartStore((s) => s.clearCart);
  const totalPrice = items.reduce((sum, i) => sum + getItemTotal(i), 0);
  const loyaltyInfo = useLoyaltyInfo();

  // Panier vide (accès direct à l'URL, refresh, ou commande déjà envoyée) :
  // rien à finaliser, on renvoie vers la carte.
  useEffect(() => {
    if (items.length === 0) router.replace('/carte');
  }, [items.length, router]);

  function handleSuccess(orderId: string) {
    clearCart();
    router.replace(`/commande/${orderId}`);
  }

  if (items.length === 0) return null;

  return (
    <div className="mx-auto max-w-xl px-4 py-8 sm:py-12">
      <h1 className="text-2xl font-bold">Finaliser ta commande</h1>

      <div className="mt-5 rounded-xl border border-foreground/10 bg-default-50 p-4">
        <div className="divide-y divide-foreground/5">
          {items.map((item) => (
            <div
              key={item.cartId}
              className="flex items-start justify-between gap-3 py-2 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {item.quantity}× {item.productName}
                </p>
                {item.supplements.length > 0 && (
                  <p className="text-xs text-foreground/45">
                    {item.supplements.map(formatSupplementLabel).join(', ')}
                  </p>
                )}
              </div>
              <p className="shrink-0 text-sm font-medium text-primary">
                {priceFormatter.format(getItemTotal(item))}&nbsp;F
              </p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex justify-between border-t border-foreground/10 pt-3 text-sm font-semibold">
          <span>Total</span>
          <span className="text-primary">
            {priceFormatter.format(totalPrice)}&nbsp;F
          </span>
        </div>
      </div>

      {loyaltyInfo.status === 'ready' &&
        loyaltyInfo.enabled &&
        totalPrice > 0 && (
          <p className="mt-3 flex items-center gap-2 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5 shrink-0" />
            {totalPrice < loyaltyInfo.minOrderAmount
              ? `Plus que ${priceFormatter.format(loyaltyInfo.minOrderAmount - totalPrice)} FCFA pour gagner ton point de fidélité !`
              : 'Cette commande te fait gagner un tampon fidélité 🎉'}
          </p>
        )}

      <div className="mt-6">
        <CheckoutForm
          items={items}
          total={totalPrice}
          onBack={() => router.push('/carte')}
          onSuccess={handleSuccess}
        />
      </div>
    </div>
  );
}
