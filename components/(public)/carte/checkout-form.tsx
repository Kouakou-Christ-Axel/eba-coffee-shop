'use client';

// components/(public)/carte/checkout-form.tsx
//
// Étape 2 du modal de commande, ordonnée comme le processus terrain :
//   1. Comment ? — je viens / j'envoie un livreur (+ infos livreur & adresse)
//   2. Qui ? — prénom + téléphone
//   3. Quand ? — dès que possible (défaut) ou créneau planifié
//   4. Note éventuelle
//
// Les données retrait (créneaux, horaires d'ouverture, adresse) sont chargées
// une seule fois via `usePickupInfo` et partagées entre les blocs 1 et 3.

import { Button } from '@heroui/react';
import { ArrowLeft } from 'lucide-react';
import type { CartItem } from '@/lib/cart-store';
import { useCheckoutForm } from '@/lib/hooks/use-checkout-form';
import { usePickupInfo } from '@/lib/hooks/use-pickup-info';
import { ContactFields } from './_components/contact-fields';
import { PickupModeCards } from './_components/pickup-mode-cards';
import { NoteField } from './_components/note-field';
import { SlotPicker } from './_components/slot-picker';

type Props = {
  items: CartItem[];
  total: number;
  onBack: () => void;
  onSuccess: (orderId: string) => void;
};

export function CheckoutForm({ items, total, onBack, onSuccess }: Props) {
  const { values, errors, isSubmitting, setField, submit } = useCheckoutForm({
    items,
    total,
  });
  const pickupInfo = usePickupInfo();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const outcome = await submit();
    if (outcome.ok) onSuccess(outcome.orderId);
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
        driverName={values.driverName}
        driverPhone={values.driverPhone}
        errors={{
          driverName: errors.driverName,
          driverPhone: errors.driverPhone,
        }}
        onDriverNameChange={(v) => setField('driverName', v)}
        onDriverPhoneChange={(v) => setField('driverPhone', v)}
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

      <SlotPicker
        timing={values.timing}
        onTimingChange={(t) => setField('timing', t)}
        value={values.pickupTime}
        onChange={(iso) => setField('pickupTime', iso)}
        error={errors.pickupTime}
        info={pickupInfo}
      />

      <NoteField
        value={values.note}
        error={errors.note}
        onChange={(v) => setField('note', v)}
      />

      {errors.submit && <p className="text-sm text-danger">{errors.submit}</p>}

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
