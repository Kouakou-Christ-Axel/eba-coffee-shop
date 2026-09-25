'use client';

// components/(public)/carte/checkout-form.tsx
//
// Étape 2 du modal de commande, ordonnée comme le processus terrain :
//   1. Comment ? — je viens / j'envoie un livreur (+ infos livreur & adresse)
//   2. Qui ? — prénom + téléphone (+ récompense fidélité si le numéro en a une)
//   3. Quand ? — dès que possible (défaut) ou créneau planifié
//   4. Note éventuelle
//
// Les données retrait (créneaux, horaires d'ouverture, adresse) sont chargées
// une seule fois via `usePickupInfo` et partagées entre les blocs 1 et 3.

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@heroui/react';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { useCartStore, type CartItem } from '@/lib/cart-store';
import { cartItemToAnalyticsItem, trackRemoveFromCart } from '@/lib/analytics';
import { effectiveItemAdvanceDays } from '@/lib/supplements';
import { useCheckoutForm } from '@/lib/hooks/use-checkout-form';
import { usePickupInfo } from '@/lib/hooks/use-pickup-info';
import { useLoyaltyReward } from '@/lib/hooks/use-loyalty-reward';
import { useLoyaltyTeaser } from '@/lib/hooks/use-loyalty-teaser';
import { ContactFields } from './_components/contact-fields';
import { LoyaltyRewardBanner } from './_components/loyalty-reward-banner';
import { PickupModeCards } from './_components/pickup-mode-cards';
import { NoteField } from './_components/note-field';
import { SlotPicker } from './_components/slot-picker';

// Panneau « Résoudre » (rupture du jour) : chargé seulement quand le serveur
// refuse une commande — la plupart des clients ne le verront jamais.
const SoldOutResolver = dynamic(
  () => import('./_components/sold-out-resolver'),
  { ssr: false }
);

type Props = {
  items: CartItem[];
  /** Total BRUT du panier (le serveur déduit lui-même la récompense). */
  total: number;
  onBack: () => void;
  onSuccess: (orderId: string) => void;
  /** Remonte la remise fidélité appliquée pour le récap de la page. */
  onLoyaltyDiscountChange?: (discount: number) => void;
};

export function CheckoutForm({
  items,
  total,
  onBack,
  onSuccess,
  onLoyaltyDiscountChange,
}: Props) {
  // Récompense appliquée par défaut (frictionless) ; le client peut la garder
  // pour une prochaine commande via le Switch du bandeau.
  const [rewardApplied, setRewardApplied] = useState(true);

  const {
    values,
    errors,
    isSubmitting,
    setField,
    submit,
    soldOutLines,
    clearSoldOutLines,
  } = useCheckoutForm({ items, total });
  const replaceItem = useCartStore((s) => s.replaceItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const patchItems = useCartStore((s) => s.patchItems);
  const slotRef = useRef<HTMLDivElement>(null);
  // Plus grand délai de commande à l'avance requis par le panier (voir
  // `CartItem.advanceOrderDays`, lib/cart-store.ts) : étend l'horizon de
  // créneaux et contraint le sélecteur (voir SlotPicker).
  //
  // `effectiveItemAdvanceDays` intègre aussi les articles ÉPUISÉS AUJOURD'HUI
  // (J+1 minimum) : un seul mécanisme de contrainte de jour, pas deux.
  const minAdvanceOrderDays = items.reduce(
    (max, i) => Math.max(max, effectiveItemAdvanceDays(i)),
    0
  );
  // Un article épuisé aujourd'hui mérite un message dédié : « commande à
  // l'avance » serait faux, ce n'est pas une règle du produit mais un état du
  // jour.
  const soldOutRestricted = items.some((i) => i.soldOutToday === true);
  const pickupInfo = usePickupInfo(minAdvanceOrderDays);
  // Recherche débouncée de la récompense du numéro saisi.
  const reward = useLoyaltyReward(values.customerPhone);

  const activeReward =
    reward.status === 'ready' && rewardApplied ? reward : null;
  const discount = activeReward ? Math.min(activeReward.capAmount, total) : 0;
  // Total net (après remise éventuelle) : c'est ce montant qui détermine si un
  // tampon sera crédité (`awardLoyaltyForOrder` teste le total NET). Le
  // message incitatif du récapitulatif se calcule donc dessus, dans un second
  // appel débouncé distinct de la recherche de récompense ci-dessus (celle-ci
  // ne dépend pas du total, la boucler dessus créerait une dépendance
  // circulaire reward → discount → netTotal → reward).
  const netTotal = Math.max(0, total - discount);
  const loyaltyMessage = useLoyaltyTeaser(values.customerPhone, netTotal);

  // Remonte la remise au récapitulatif de la page (au-dessus du formulaire).
  useEffect(() => {
    onLoyaltyDiscountChange?.(discount);
  }, [discount, onLoyaltyDiscountChange]);

  async function send() {
    const outcome = await submit(activeReward);
    if (outcome.ok) onSuccess(outcome.orderId);
    // Récompense consommée entre-temps : on la retire pour que le prochain
    // envoi passe sans elle (le message l'explique au client).
    if (!outcome.ok && outcome.code === 'LOYALTY_REWARD_UNAVAILABLE') {
      setRewardApplied(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await send();
  }

  // Résolution d'une rupture — le panier est la source de vérité : une ligne
  // remplacée ou retirée en disparaît, une ligne reportée y est marquée
  // `soldOutToday` (J+1 minimum via `effectiveItemAdvanceDays`).
  function handleRemove(cartId: string) {
    const item = items.find((i) => i.cartId === cartId);
    if (item) trackRemoveFromCart([cartItemToAnalyticsItem(item)]);
    removeItem(cartId);
  }

  function handleDeferAll(cartIds: string[]) {
    patchItems(
      Object.fromEntries(cartIds.map((id) => [id, { soldOutToday: true }]))
    );
    clearSoldOutLines();
    // Le sélecteur bascule seul en « Planifier » dès qu'un article exige
    // J+1 ; on y amène le client pour qu'il choisisse son créneau.
    setField('timing', 'scheduled');
    setField('pickupTime', null);
    requestAnimationFrame(() =>
      slotRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 self-start text-sm text-foreground/50 transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Retour au panier
      </button>

      <PickupModeCards
        mode={values.pickupMode}
        onModeChange={(m) => setField('pickupMode', m)}
        pickupAddress={
          pickupInfo.status === 'ready' ? pickupInfo.pickupAddress : null
        }
        pickupMapsUrl={
          pickupInfo.status === 'ready' ? pickupInfo.pickupMapsUrl : null
        }
      />

      <ContactFields
        name={values.customerName}
        phone={values.customerPhone}
        errors={{
          customerName: errors.customerName,
          customerPhone: errors.customerPhone,
        }}
        onNameChange={(v) => setField('customerName', v)}
        onPhoneChange={(v) => setField('customerPhone', v)}
      />

      {reward.status === 'ready' && (
        <LoyaltyRewardBanner
          capAmount={reward.capAmount}
          applied={rewardApplied}
          onAppliedChange={setRewardApplied}
        />
      )}

      {loyaltyMessage && (
        <p className="flex items-center gap-2 text-xs font-medium text-primary">
          <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {loyaltyMessage}
        </p>
      )}

      <div ref={slotRef} className="scroll-mt-28">
        <SlotPicker
          timing={values.timing}
          onTimingChange={(t) => setField('timing', t)}
          value={values.pickupTime}
          onChange={(iso) => setField('pickupTime', iso)}
          error={errors.pickupTime}
          info={pickupInfo}
          items={items}
          minAdvanceOrderDays={minAdvanceOrderDays}
          soldOutRestricted={soldOutRestricted}
        />
      </div>

      <NoteField
        value={values.note}
        error={errors.note}
        onChange={(v) => setField('note', v)}
      />

      {errors.submit && <p className="text-sm text-danger">{errors.submit}</p>}

      {soldOutLines.length > 0 && (
        <SoldOutResolver
          isOpen
          onClose={clearSoldOutLines}
          lines={soldOutLines}
          items={items}
          onReplace={replaceItem}
          onReduce={updateQuantity}
          onRemove={handleRemove}
          onDeferAll={handleDeferAll}
          onSubmit={() => void send()}
          isSubmitting={isSubmitting}
        />
      )}

      <Button
        type="submit"
        color="primary"
        size="lg"
        className="w-full"
        isLoading={isSubmitting}
        isDisabled={isSubmitting}
      >
        Confirmer la commande
      </Button>
    </form>
  );
}
