'use client';

// État de la vue « Nouvelle commande » (caisse). Panier LOCAL, volontairement
// distinct du store Zustand partagé avec le checkout public.

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Product } from '@/config/menu';
import {
  getItemTotal,
  type CartItem,
  type CartItemSupplement,
} from '@/lib/cart-store';
import type { OrderType } from '@/generated/prisma/client';
import { isDeferredPickup } from '@/lib/orders/scheduling';
import type { ShortageLine } from '@/lib/orders/shortage';
import type { OrderDraftSnapshot } from '@/lib/parked-orders-store';
import { useParkedOrders } from '@/lib/hooks/use-parked-orders';
import {
  addItem,
  removeItem,
  setItemDiscount,
  setItemQuantity,
} from './new-order/cart';
import { useLoyaltyLookup } from './new-order/use-loyalty-lookup';
import { useProductPicker } from './new-order/use-product-picker';
import { useSoldOutPrompt } from './new-order/use-sold-out-prompt';
import { submitNewOrder } from './new-order/submit';

export type {
  LoyaltyCard,
  LoyaltyReward,
} from './new-order/use-loyalty-lookup';

export type NewOrderStep = 'catalog' | 'review';

export type UseNewOrder = ReturnType<typeof useNewOrder>;

export type UseNewOrderOptions = {
  /** Où revenir après annulation / création réussie. Défaut : la caisse. */
  backHref?: string;
  /** Type de commande présélectionné (ex. `DINE_IN` depuis l'écran cuisine). */
  initialOrderType?: OrderType;
};

export function useNewOrder(opts?: UseNewOrderOptions) {
  const router = useRouter();
  const backHref = opts?.backHref ?? '/dashboard/caisse';

  const [step, setStep] = useState<NewOrderStep>('catalog');
  const [items, setItems] = useState<CartItem[]>([]);

  const {
    pickerProduct,
    isPickerOpen,
    pickerCartId,
    pickerInitialSupplements,
    openPicker,
    duplicateLineWithOptions,
    closePicker,
  } = useProductPicker(items);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderType, setOrderType] = useState<OrderType>(
    opts?.initialOrderType ?? 'DELIVERY'
  );
  const [note, setNote] = useState('');
  const [pickupTime, setPickupTime] = useState<string | null>(null);
  // Antidatage : YYYY-MM-DD pour une commande ancienne. null = jour en cours.
  const [orderDate, setOrderDate] = useState<string | null>(null);
  // Retrait un JOUR CIVIL ULTÉRIEUR : relâche le blocage stock (catalogue, goûts).
  const isDeferredDay = isDeferredPickup(pickupTime);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, startSubmit] = useTransition();

  const { loyaltyCard, loyaltyRewardId, setLoyaltyRewardId } =
    useLoyaltyLookup(customerPhone);

  const totalItems = useMemo(
    () => items.reduce((s, i) => s + i.quantity, 0),
    [items]
  );
  const totalPrice = useMemo(
    () => items.reduce((s, i) => s + getItemTotal(i), 0),
    [items]
  );

  const selectedReward = useMemo(
    () =>
      loyaltyCard?.availableRewards.find((r) => r.id === loyaltyRewardId) ??
      null,
    [loyaltyCard, loyaltyRewardId]
  );
  const loyaltyDiscount = selectedReward
    ? Math.min(selectedReward.capAmount, totalPrice)
    : 0;
  const totalDue = totalPrice - loyaltyDiscount;

  function addToCart(product: Product, supplements: CartItemSupplement[]) {
    setItems((prev) => addItem(prev, product, supplements));
  }

  const {
    soldOutPrompt,
    handleProductTap,
    resolveSoldOutPrompt,
    dismissSoldOutPrompt,
    promptSoldOutDay,
  } = useSoldOutPrompt({ isDeferredDay, setPickupTime, addToCart, openPicker });

  function handleQuantityChange(cartId: string, quantity: number) {
    setItems((prev) => setItemQuantity(prev, cartId, quantity));
  }

  function handleRemove(cartId: string) {
    setItems((prev) => removeItem(prev, cartId));
  }

  function handleDiscountChange(
    cartId: string,
    discount: number,
    reason: string | null
  ) {
    setItems((prev) => setItemDiscount(prev, cartId, discount, reason));
  }

  // Pénurie à la création (409 avec `shortage`) : pilote le retry `coverShortage: true`.
  const [pendingShortage, setPendingShortage] = useState<ShortageLine[] | null>(
    null
  );

  // Commandes mises de côté : le brouillon courant est capturé / restauré en bloc.
  const initialOrderType = opts?.initialOrderType ?? 'DELIVERY';
  const parkedOrders = useParkedOrders({
    snapshot: {
      step,
      items,
      customerName,
      customerPhone,
      orderType,
      note,
      pickupTime,
      orderDate,
      loyaltyRewardId,
    },
    apply: (d: OrderDraftSnapshot) => {
      setStep(d.step);
      setItems(d.items);
      setCustomerName(d.customerName);
      setCustomerPhone(d.customerPhone);
      setOrderType(d.orderType);
      setNote(d.note);
      setPickupTime(d.pickupTime);
      setOrderDate(d.orderDate);
      setLoyaltyRewardId(d.loyaltyRewardId);
      setSubmitError(null);
      setPendingShortage(null);
    },
    reset: () => {
      setStep('catalog');
      setItems([]);
      setCustomerName('');
      setCustomerPhone('');
      setOrderType(initialOrderType);
      setNote('');
      setPickupTime(null);
      setOrderDate(null);
      setLoyaltyRewardId(null);
      setSubmitError(null);
      setPendingShortage(null);
    },
  });

  function goBackOrCancel() {
    if (step === 'review') {
      setStep('catalog');
    } else {
      router.push(backHref);
    }
  }

  function onOrderCreated(dailyNumber: number | null) {
    // Pas de `router.refresh()` : la file est alimentée par SSE.
    router.push(
      dailyNumber === null ? backHref : `${backHref}?cree=${dailyNumber}`
    );
  }

  function submit(coverShortage?: boolean) {
    if (items.length === 0) return;
    if (pickupTime && !customerPhone.trim()) {
      setSubmitError(
        'Le numéro de téléphone est obligatoire pour une commande différée'
      );
      return;
    }
    setSubmitError(null);
    setPendingShortage(null);
    startSubmit(async () => {
      await submitNewOrder(
        {
          items,
          total: totalPrice,
          customerName: customerName.trim() || null,
          customerPhone: customerPhone.trim() || null,
          orderType,
          note: note.trim() || null,
          pickupTime: pickupTime ?? null,
          orderDate: orderDate ?? null,
          loyaltyRewardId,
          ...(coverShortage ? { coverShortage: true } : {}),
        },
        {
          onCreated: onOrderCreated,
          onShortage: setPendingShortage,
          onError: setSubmitError,
        }
      );
    });
  }

  /** Le staff a confirmé avoir produit le manquant : relance avec le drapeau. */
  function confirmShortageAndRetry() {
    submit(true);
  }

  function dismissShortage() {
    setPendingShortage(null);
  }

  return {
    // état
    step,
    items,
    totalItems,
    totalPrice,
    loyaltyCard,
    loyaltyRewardId,
    selectedReward,
    loyaltyDiscount,
    totalDue,
    setLoyaltyRewardId,
    pickerProduct,
    isPickerOpen,
    pickerCartId,
    pickerInitialSupplements,
    customerName,
    customerPhone,
    orderType,
    note,
    pickupTime,
    orderDate,
    isDeferredDay,
    soldOutPrompt,
    submitError,
    isSubmitting,
    pendingShortage,
    confirmShortageAndRetry,
    dismissShortage,
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
    openPicker,
    duplicateLineWithOptions,
    handleQuantityChange,
    handleRemove,
    handleDiscountChange,
    // modale suppléments
    closePicker,
    // feuille de rattrapage « épuisé aujourd'hui »
    resolveSoldOutPrompt,
    dismissSoldOutPrompt,
    promptSoldOutDay,
    // navigation
    goBackOrCancel,
    // soumission
    submit,
    // commandes mises de côté
    parkedOrders,
  };
}
