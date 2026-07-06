'use client';

import { Button } from '@heroui/react';
import { ArrowLeft } from 'lucide-react';
import type { CartItem } from '@/lib/cart-store';
import { useCheckoutForm } from '@/lib/hooks/use-checkout-form';
import { ContactFields } from './_components/contact-fields';
import { DriverFields } from './_components/driver-fields';
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
        value={values.pickupTime}
        onChange={(iso) => setField('pickupTime', iso)}
        error={errors.pickupTime}
      />

      <DriverFields
        name={values.driverName}
        phone={values.driverPhone}
        errors={{
          driverName: errors.driverName,
          driverPhone: errors.driverPhone,
        }}
        onNameChange={(v) => setField('driverName', v)}
        onPhoneChange={(v) => setField('driverPhone', v)}
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
