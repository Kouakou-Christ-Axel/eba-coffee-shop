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

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Product } from '@/config/menu';
import {
  getItemTotal,
  type CartItem,
  type CartItemSupplement,
} from '@/lib/cart-store';
import type { OrderType } from '@/generated/prisma/client';
import { isProductSoldOut, productNeedsPicker } from '@/lib/catalog';
import { isDeferredPickup } from '@/lib/orders/scheduling';
import { readApiError } from '@/lib/api-error';

export type NewOrderStep = 'catalog' | 'review';

export type LoyaltyReward = { id: string; tier: number; capAmount: number };
export type LoyaltyCard = {
  stampCount: number;
  stampsPerCard: number;
  availableRewards: LoyaltyReward[];
};

const MIN_LOYALTY_PHONE_LENGTH = 8;
const LOYALTY_DEBOUNCE_MS = 400;

function makeCartId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function supplementsKey(supplements: CartItemSupplement[]): string {
  return JSON.stringify(
    supplements
      .map(
        (s) => `${s.groupName}:${s.optionName}:${s.price}:${s.quantity ?? 1}`
      )
      .sort()
  );
}

export type UseNewOrder = ReturnType<typeof useNewOrder>;

export function useNewOrder() {
  const router = useRouter();

  const [step, setStep] = useState<NewOrderStep>('catalog');
  const [items, setItems] = useState<CartItem[]>([]);

  // Supplément en cours de sélection (modale). `pickerCartId` non nul = on
  // pré-remplit depuis une ligne existante pour AJOUTER un nouvel exemplaire
  // avec des suppléments possiblement différents (« Dupliquer »), plutôt que
  // partir de zéro comme depuis le catalogue — voir `duplicateLineWithOptions`.
  const [pickerProduct, setPickerProduct] = useState<Product | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerCartId, setPickerCartId] = useState<string | null>(null);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderType, setOrderType] = useState<OrderType>('DELIVERY');
  const [note, setNote] = useState('');
  const [pickupTime, setPickupTime] = useState<string | null>(null);
  // Antidatage : YYYY-MM-DD pour une commande ancienne. null = jour en cours.
  const [orderDate, setOrderDate] = useState<string | null>(null);
  // Produit épuisé tapé alors qu'on est sur « Maintenant » : déclenche la
  // feuille « pour quel jour ? » (null = fermée).
  const [soldOutPrompt, setSoldOutPrompt] = useState<Product | null>(null);

  // Le retrait tombe-t-il un JOUR CIVIL ULTÉRIEUR ? Pilote tout le relâchement
  // du blocage stock dans le catalogue et le sélecteur de goûts.
  const isDeferredDay = isDeferredPickup(pickupTime);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, startSubmit] = useTransition();

  // Fidélité : carte du client identifié par téléphone (tampons + récompenses
  // disponibles), et récompense choisie pour cette commande (au plus une).
  const [loyaltyCard, setLoyaltyCard] = useState<LoyaltyCard | null>(null);
  const [loyaltyRewardId, setLoyaltyRewardId] = useState<string | null>(null);
  const loyaltyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loyaltyAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (loyaltyTimer.current) clearTimeout(loyaltyTimer.current);
    // Différé (même pour la remise à zéro) : le setState ne doit jamais
    // s'exécuter de façon synchrone dans le corps de l'effet.
    loyaltyTimer.current = setTimeout(() => {
      const phone = customerPhone.trim();
      if (phone.length < MIN_LOYALTY_PHONE_LENGTH) {
        setLoyaltyCard(null);
        setLoyaltyRewardId(null);
        return;
      }
      loyaltyAbort.current?.abort();
      const controller = new AbortController();
      loyaltyAbort.current = controller;
      fetch(`/api/caisse/loyalty?phone=${encodeURIComponent(phone)}`, {
        signal: controller.signal,
      })
        .then((res) => (res.ok ? res.json() : { card: null }))
        .then((data: { card: LoyaltyCard | null }) => {
          setLoyaltyCard(data.card);
          setLoyaltyRewardId((prev) => {
            // La récompense sélectionnée n'a plus cours (client différent /
            // récompense entre-temps utilisée ailleurs) : on la désélectionne.
            if (
              prev &&
              data.card?.availableRewards.some((r) => r.id === prev)
            ) {
              return prev;
            }
            // Sinon, application automatique de la récompense disponible la
            // plus ancienne (le caissier reste libre de la désélectionner).
            return data.card?.availableRewards[0]?.id ?? null;
          });
        })
        .catch(() => {
          // Requête annulée ou erreur réseau : pas de carte affichée.
        });
    }, LOYALTY_DEBOUNCE_MS);
  }, [customerPhone]);

  useEffect(() => {
    return () => {
      if (loyaltyTimer.current) clearTimeout(loyaltyTimer.current);
      loyaltyAbort.current?.abort();
    };
  }, []);

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
        advanceOrderDays: product.advanceOrderDays,
      };
      return [...prev, item];
    });
  }

  /**
   * Tap sur une tuile du catalogue. Ajoute directement au panier sauf si le
   * produit impose un choix (`productNeedsPicker` — voir lib/catalog.ts pour
   * pourquoi ce n'est PAS « le produit a des suppléments »).
   *
   * FILET DE RATTRAPAGE : sur « Maintenant », taper un produit épuisé ouvre la
   * question « pour quel jour ? » au lieu de ne rien faire. Le geste est
   * mémorisé et rejoué après le choix — le tap n'est jamais perdu, c'est tout
   * l'intérêt : le caissier n'a pas à recommencer sa saisie.
   */
  function handleProductTap(product: Product) {
    if (!isDeferredDay && isProductSoldOut(product)) {
      setSoldOutPrompt(product);
      return;
    }
    if (!productNeedsPicker(product)) {
      addToCart(product, []);
      return;
    }
    openPicker(product);
  }

  /**
   * Le caissier a choisi un jour depuis la feuille de rattrapage : on bascule
   * TOUTE la commande sur ce jour, puis on rejoue le tap en attente.
   */
  function resolveSoldOutPrompt(iso: string) {
    const product = soldOutPrompt;
    setSoldOutPrompt(null);
    setPickupTime(iso);
    if (!product) return;
    if (!productNeedsPicker(product)) {
      addToCart(product, []);
      return;
    }
    openPicker(product);
  }

  /** Ouvre le sélecteur à la demande (bouton « Options » d'une tuile). */
  function openPicker(product: Product) {
    setPickerCartId(null);
    setPickerProduct(product);
    setIsPickerOpen(true);
  }

  // Ouvre le sélecteur pré-rempli avec les suppléments de `item`, pour ajouter
  // UN exemplaire de plus (pas modifier la ligne existante) — ex. 2 crêpes
  // dont une seule avec chantilly, ce que le simple stepper +/- ne permet pas
  // puisqu'il applique les mêmes suppléments à toute la ligne.
  function duplicateLineWithOptions(product: Product, cartId: string) {
    setPickerCartId(cartId);
    setPickerProduct(product);
    setIsPickerOpen(true);
  }

  const pickerInitialSupplements = pickerCartId
    ? (items.find((i) => i.cartId === pickerCartId)?.supplements ?? [])
    : [];

  function closePicker() {
    setIsPickerOpen(false);
    setPickerProduct(null);
    setPickerCartId(null);
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
            loyaltyRewardId,
          }),
        });
        if (!res.ok) {
          setSubmitError(await readApiError(res));
          return;
        }
        // Le n° du jour est renvoyé par l'API : on le passe à la file, qui
        // affiche une confirmation « Commande #012 créée ». Sans ça le caissier
        // n'a AUCUN retour après avoir validé.
        let createdNumber: number | null = null;
        try {
          const data = (await res.json()) as { dailyNumber?: number };
          if (typeof data.dailyNumber === 'number')
            createdNumber = data.dailyNumber;
        } catch {
          // Confirmation best-effort : une réponse illisible ne doit pas
          // transformer une commande créée en erreur.
        }
        // Pas de `router.refresh()` ici : la file est alimentée par SSE
        // (`/api/caisse/stream`) et reçoit la nouvelle commande d'elle-même.
        // Un refresh forcerait un re-rendu RSC complet pour rien.
        router.push(
          createdNumber === null
            ? '/dashboard/caisse'
            : `/dashboard/caisse?cree=${createdNumber}`
        );
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
    dismissSoldOutPrompt: () => setSoldOutPrompt(null),
    promptSoldOutDay: (product: Product) => setSoldOutPrompt(product),
    // navigation
    goBackOrCancel,
    // soumission
    submit,
  };
}
