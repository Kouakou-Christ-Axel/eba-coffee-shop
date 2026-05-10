'use client';

import { useState, useMemo } from 'react';
import { Button, Input } from '@heroui/react';
import { ArrowLeft } from 'lucide-react';
import { generatePickupSlots } from '@/lib/pickup-slots';
import {
  submitCheckoutForm,
  type CheckoutErrors,
  type CheckoutFields,
} from '@/lib/checkout-submit';
import type { CartItem } from '@/lib/cart-store';

type Props = {
  items: CartItem[];
  total: number;
  onBack: () => void;
  onSuccess: (orderId: string) => void;
};

export function CheckoutForm({ items, total, onBack, onSuccess }: Props) {
  const slots = useMemo(() => generatePickupSlots(new Date()), []);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todaySlots = slots.filter((s) => {
    const d = new Date(s.getFullYear(), s.getMonth(), s.getDate());
    return d.getTime() === today.getTime();
  });
  const tomorrowSlots = slots.filter((s) => {
    const d = new Date(s.getFullYear(), s.getMonth(), s.getDate());
    return d.getTime() !== today.getTime();
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fields: CheckoutFields = {
      customerName,
      customerPhone,
      pickupTime: selectedSlot,
    };
    setIsSubmitting(true);
    setErrors({});
    await submitCheckoutForm({
      fields,
      items,
      total,
      onSuccess,
      onError: (errs) => {
        setErrors(errs);
        setIsSubmitting(false);
      },
    });
  }

  function renderSlotGroup(groupSlots: Date[], label: string) {
    if (groupSlots.length === 0) return null;
    return (
      <div className="flex flex-col gap-1.5">
        <p className="text-xs text-foreground/50">{label}</p>
        <div className="flex flex-wrap gap-2">
          {groupSlots.map((slot) => {
            const iso = slot.toISOString();
            const h = String(slot.getHours()).padStart(2, '0');
            const m = String(slot.getMinutes()).padStart(2, '0');
            const isSelected = selectedSlot === iso;
            return (
              <button
                key={iso}
                type="button"
                onClick={() => setSelectedSlot(iso)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  isSelected
                    ? 'border-primary bg-primary text-white'
                    : 'border-foreground/20 hover:border-primary'
                }`}
              >
                {`${h}h${m}`}
              </button>
            );
          })}
        </div>
      </div>
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

      <Input
        label="Prénom"
        value={customerName}
        onValueChange={setCustomerName}
        isInvalid={!!errors.customerName}
        errorMessage={errors.customerName}
        isRequired
        autoComplete="given-name"
      />

      <Input
        label="Téléphone"
        value={customerPhone}
        onValueChange={setCustomerPhone}
        isInvalid={!!errors.customerPhone}
        errorMessage={errors.customerPhone}
        isRequired
        autoComplete="tel"
        placeholder="07 00 00 00 00"
      />

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Créneau de retrait</p>
        {errors.pickupTime && (
          <p className="text-xs text-danger">{errors.pickupTime}</p>
        )}
        {renderSlotGroup(todaySlots, "Aujourd'hui")}
        {renderSlotGroup(tomorrowSlots, 'Demain')}
        {slots.length === 0 && (
          <p className="text-xs text-foreground/50">
            {
              "Aucun créneau disponible aujourd'hui. Revenez demain à partir de 08h00."
            }
          </p>
        )}
      </div>

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
