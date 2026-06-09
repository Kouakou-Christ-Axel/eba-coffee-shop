'use client';

// lib/hooks/use-new-order.ts
//
// Hook orchestrant l'état de la vue "Nouvelle commande" côté caisse
// (dashboard). Centralise :
//   - le panier local (items + dérivés totalItems / totalPrice)
//   - l'étape active (catalog / review)
//   - les infos client (nom, téléphone, type, note)
//   - la soumission POST /api/caisse/orders
//
// Pourquoi pas le store global `lib/cart-store.ts` ?
//   Le store Zustand est partagé avec le checkout public ; la caisse doit
//   pouvoir saisir plusieurs commandes successives sans interférer avec le
//   panier du client. On garde donc un état local — encapsulé dans ce hook
//   pour soulager `new-order-view.tsx`.

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Product } from '@/config/menu';
import {
  getItemTotal,
  type CartItem,
  type CartItemSupplement,
} from '@/lib/cart-store';
import type { OrderType } from '@/generated/prisma/client';

export type NewOrderStep = 'catalog' | 'review';

function makeCartId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function supplementsKey(supplements: CartItemSupplement[]): string {
  return JSON.stringify(
    supplements.map((s) => `${s.groupName}:${s.optionName}:${s.price}`).sort()
  );
}

export type UseNewOrder = ReturnType<typeof useNewOrder>;

export function useNewOrder() {
  const router = useRouter();

  const [step, setStep] = useState<NewOrderStep>('catalog');
  const [items, setItems] = useState<CartItem[]>([]);

  // Supplément en cours de sélection (modale)
  const [pickerProduct, setPickerProduct] = useState<Product | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderType, setOrderType] = useState<OrderType>('TAKEAWAY');
  const [note, setNote] = useState('');
  const [pickupTime, setPickupTime] = useState<string | null>(null);
  // Antidatage : YYYY-MM-DD pour une commande ancienne. null = jour en cours.
  const [orderDate, setOrderDate] = useState<string | null>(null);

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
        coutMatiere: product.coutMatiere ?? 0,
        coutEmballage: product.coutEmballage ?? 0,
        quantity: 1,
        supplements,
      };
      return [...prev, item];
    });
  }

  function handleProductTap(product: Product) {
    const hasSupplements = (product.supplements?.length ?? 0) > 0;
    if (!hasSupplements) {
      addToCart(product, []);
      return;
    }
    setPickerProduct(product);
    setIsPickerOpen(true);
  }

  function closePicker() {
    setIsPickerOpen(false);
    setPickerProduct(null);
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

  function handleDiscountChange(
    cartId: string,
    discount: number,
    reason: string | null
  ) {
    setItems((prev) =>
      prev.map((i) =>
        i.cartId === cartId ? { ...i, discount, discountReason: reason } : i
      )
    );
  }

  function goBackOrCancel() {
    if (step === 'review') {
      setStep('catalog');
    } else {
      router.push('/dashboard/caisse');
    }
  }

  function submit() {
    if (items.length === 0) return;
    if (pickupTime && !customerPhone.trim()) {
      setSubmitError(
        'Le numéro de téléphone est obligatoire pour une commande différée'
      );
      return;
    }
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
            pickupTime: pickupTime ?? null,
            orderDate: orderDate ?? null,
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

  return {
    // état
    step,
    items,
    totalItems,
    totalPrice,
    pickerProduct,
    isPickerOpen,
    customerName,
    customerPhone,
    orderType,
    note,
    pickupTime,
    orderDate,
    submitError,
    isSubmitting,
    // setters d'étape
    setStep,
    // setters client
    setCustomerName,
    setCustomerPhone,
    setOrderType,
    setNote,
    setPickupTime,
    setOrderDate,
    // actions panier
    addToCart,
    handleProductTap,
    handleQuantityChange,
    handleRemove,
    handleDiscountChange,
    // modale suppléments
    closePicker,
    // navigation
    goBackOrCancel,
    // soumission
    submit,
  };
}
