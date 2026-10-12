'use client';

// Étape 2 du modal de commande : comment (retrait / livreur), qui (contact +
// récompense fidélité), quand (dès que possible ou créneau), note. Les données
// retrait sont chargées une fois via `usePickupInfo`.

import dynamic from 'next/dynamic';
import { Button } from '@heroui/react';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { priceFormatter } from '@/config/menu';
import { ContactFields } from './_components/contact-fields';
import { LoyaltyRewardBanner } from './_components/loyalty-reward-banner';
import { PickupModeCards } from './_components/pickup-mode-cards';
import { PrecommandeBanner } from './_components/precommande-banner';
import { NoteField } from './_components/note-field';
import { PaymentMethodPicker } from './_components/payment-method-picker';
import { SlotPicker } from './_components/slot-picker';
import {
  GoneItemsBanner,
  PreSoldOutBanner,
} from './_components/checkout/availability-banners';
import type { CheckoutFormProps } from './_components/checkout/types';
import { useCheckoutFlow } from './_components/checkout/use-checkout-flow';

// Panneau « Résoudre » (rupture du jour) : chargé seulement quand une rupture
// est détectée — la plupart des clients ne le verront jamais.
const SoldOutResolver = dynamic(
  () => import('./_components/sold-out-resolver'),
  { ssr: false }
);

export function CheckoutForm(props: CheckoutFormProps) {
  const { items, onBack, menu, onlinePayment } = props;
  const flow = useCheckoutFlow(props);
  const {
    values,
    errors,
    isSubmitting,
    setField,
    soldOutLines,
    showSoldOutLines,
    clearSoldOutLines,
    replaceItem,
    updateQuantity,
    slotRef,
    contactFieldsRef,
    submitErrorRef,
    minAdvanceOrderDays,
    soldOutRestricted,
    precommandePure,
    pickupInfo,
    reward,
    rewardApplied,
    setRewardApplied,
    loyaltyMessage,
    payOnline,
    amountDue,
    goneItems,
    preSoldOutLines,
    send,
    handleSubmit,
    handleRemove,
    handleDeferAll,
  } = flow;

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

      {goneItems.length > 0 && (
        <GoneItemsBanner goneItems={goneItems} onRemove={handleRemove} />
      )}

      {goneItems.length === 0 && preSoldOutLines.length > 0 && (
        <PreSoldOutBanner
          lines={preSoldOutLines}
          onResolve={showSoldOutLines}
        />
      )}

      {/* Statut global, sous les bandeaux d'erreur (actionnables/urgents) :
          ceux-ci restent prioritaires au-dessus. Créneau connu une fois
          choisi plus bas (SlotPicker), affiché ici dès qu'il existe. */}
      {soldOutRestricted && (
        <PrecommandeBanner pickupTime={values.pickupTime} />
      )}

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

      <div ref={contactFieldsRef} className="scroll-mt-28">
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
      </div>

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
          precommandePure={precommandePure}
        />
      </div>

      <NoteField
        value={values.note}
        error={errors.note}
        onChange={(v) => setField('note', v)}
      />

      {onlinePayment.status === 'ready' && onlinePayment.enabled && (
        <PaymentMethodPicker
          methods={onlinePayment.methods}
          value={values.paymentMethod}
          onChange={(m) => setField('paymentMethod', m)}
          error={errors.paymentMethod}
        />
      )}

      {onlinePayment.status === 'error' && (
        <p role="alert" className="text-sm text-danger">
          Impossible de charger les moyens de paiement. Recharge la page pour
          réessayer.
        </p>
      )}

      {errors.submit && (
        <p ref={submitErrorRef} role="alert" className="text-sm text-danger">
          {errors.submit}
        </p>
      )}

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
          menu={menu}
        />
      )}

      <Button
        type="submit"
        color="primary"
        size="lg"
        className="w-full"
        isLoading={isSubmitting}
        // Tant que la config du paiement n'est pas connue (ou a échoué), envoyer
        // créerait une commande sans moyen de paiement alors que le serveur en
        // exige un.
        isDisabled={isSubmitting || onlinePayment.status !== 'ready'}
      >
        {payOnline
          ? `Payer ${priceFormatter.format(amountDue)} F`
          : 'Confirmer la commande'}
      </Button>
    </form>
  );
}
