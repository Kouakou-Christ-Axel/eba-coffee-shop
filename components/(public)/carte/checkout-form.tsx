'use client';

import { useState, useMemo, useEffect } from 'react';
import { Button, Input } from '@heroui/react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ArrowLeft, Clock } from 'lucide-react';
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

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(slotDate: Date, today: Date): string {
  const slotKey = dateKey(slotDate);
  const todayKey = dateKey(today);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowKey = dateKey(tomorrow);

  if (slotKey === todayKey) return "Aujourd'hui";
  if (slotKey === tomorrowKey) return 'Demain';
  return slotDate.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });
}

export function CheckoutForm({ items, total, onBack, onSuccess }: Props) {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [slots, setSlots] = useState<Date[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/pickup-slots')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: { slots: string[] }) => {
        if (cancelled) return;
        setSlots(data.slots.map((s) => new Date(s)));
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError(true);
        setSlots([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const today = useMemo(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }, []);

  const slotsByDay = useMemo(() => {
    const map = new Map<string, Date[]>();
    if (!slots) return map;
    for (const s of slots) {
      const key = dateKey(s);
      const arr = map.get(key) ?? [];
      arr.push(s);
      map.set(key, arr);
    }
    return map;
  }, [slots]);

  const dayKeys = useMemo(() => Array.from(slotsByDay.keys()), [slotsByDay]);

  const [activeDay, setActiveDay] = useState<string | null>(null);

  if (activeDay === null && dayKeys.length > 0) {
    setActiveDay(dayKeys[0]);
  }

  const selectedDate = selectedSlot ? new Date(selectedSlot) : null;
  const selectedLabel = selectedDate
    ? `${dayLabel(selectedDate, today)} à ${String(
        selectedDate.getHours()
      ).padStart(2, '0')}h${String(selectedDate.getMinutes()).padStart(2, '0')}`
    : null;

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
      onSuccess: (orderId) => {
        setIsSubmitting(false);
        onSuccess(orderId);
      },
      onError: (errs) => {
        setErrors(errs);
        setIsSubmitting(false);
      },
    });
  }

  function periodOf(slot: Date): 'morning' | 'noon' | 'afternoon' | 'evening' {
    const h = slot.getHours();
    if (h < 12) return 'morning';
    if (h < 14) return 'noon';
    if (h < 18) return 'afternoon';
    return 'evening';
  }

  const periodLabels: Record<ReturnType<typeof periodOf>, string> = {
    morning: 'Matin',
    noon: 'Midi',
    afternoon: 'Après-midi',
    evening: 'Soir',
  };

  function renderSlotPeriods(daySlots: Date[]) {
    if (daySlots.length === 0) {
      return (
        <p className="py-4 text-center text-xs text-foreground/50">
          Aucun créneau disponible.
        </p>
      );
    }

    const periods = ['morning', 'noon', 'afternoon', 'evening'] as const;
    return (
      <div className="flex flex-col gap-4 pt-3">
        {periods.map((period) => {
          const slotsInPeriod = daySlots.filter((s) => periodOf(s) === period);
          if (slotsInPeriod.length === 0) return null;
          return (
            <div key={period} className="flex flex-col gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/50">
                {periodLabels[period]}
              </p>
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5 md:grid-cols-6">
                {slotsInPeriod.map((slot) => {
                  const iso = slot.toISOString();
                  const h = String(slot.getHours()).padStart(2, '0');
                  const m = String(slot.getMinutes()).padStart(2, '0');
                  const isSelected = selectedSlot === iso;
                  return (
                    <button
                      key={iso}
                      type="button"
                      onClick={() => setSelectedSlot(iso)}
                      aria-pressed={isSelected}
                      className={`rounded-md border px-2 py-2 text-sm font-medium transition-all ${
                        isSelected
                          ? 'border-primary bg-primary text-white shadow-sm'
                          : 'border-foreground/15 hover:border-primary/60 hover:bg-primary/5'
                      }`}
                    >
                      {`${h}h${m}`}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
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
        type="tel"
        value={customerPhone}
        onValueChange={setCustomerPhone}
        isInvalid={!!errors.customerPhone}
        errorMessage={errors.customerPhone}
        isRequired
        autoComplete="tel"
        placeholder="07 00 00 00 00"
      />

      <div className="flex flex-col gap-2">
        <div className="flex w-full items-baseline justify-between">
          <p className="text-sm font-medium">Créneau de retrait</p>
          {selectedLabel && (
            <span className="flex items-center gap-1 text-xs text-primary">
              <Clock className="h-3 w-3" />
              {selectedLabel}
            </span>
          )}
        </div>
        {errors.pickupTime && (
          <p className="text-xs text-danger">{errors.pickupTime}</p>
        )}
        {slots === null ? (
          <p className="rounded-md border border-foreground/15 px-3 py-4 text-center text-xs text-foreground/50">
            Chargement des créneaux…
          </p>
        ) : loadError ? (
          <p className="rounded-md border border-foreground/15 px-3 py-4 text-center text-xs text-foreground/50">
            Impossible de charger les créneaux. Rechargez la page.
          </p>
        ) : dayKeys.length === 0 ? (
          <p className="rounded-md border border-foreground/15 px-3 py-4 text-center text-xs text-foreground/50">
            Aucun créneau disponible pour le moment.
          </p>
        ) : (
          <Tabs value={activeDay ?? dayKeys[0]} onValueChange={setActiveDay}>
            <TabsList className="w-full [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {dayKeys.map((key) => {
                const daySlots = slotsByDay.get(key) ?? [];
                const sample = daySlots[0];
                return (
                  <TabsTrigger key={key} value={key}>
                    {sample ? dayLabel(sample, today) : key}
                  </TabsTrigger>
                );
              })}
            </TabsList>
            {dayKeys.map((key) => {
              const daySlots = slotsByDay.get(key) ?? [];
              return (
                <TabsContent key={key} value={key}>
                  {renderSlotPeriods(daySlots)}
                </TabsContent>
              );
            })}
          </Tabs>
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
