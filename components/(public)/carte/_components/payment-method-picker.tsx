'use client';

// components/(public)/carte/_components/payment-method-picker.tsx
//
// Choix du moyen de paiement au checkout : « Comment veux-tu payer ? ». Même
// langage visuel que `PickupModeCards`. Les moyens viennent du serveur
// (`GET /api/paiement/config`) : on ne propose que ce qu'il sait traiter. Les
// libellés sont ceux de la caisse et des stats (`PAYMENT_MODE_LABELS`).

import {
  JEKO_PAYMENT_METHOD_LABELS,
  JEKO_TO_PAYMENT_MODE,
  type JekoPaymentMethod,
} from '@/lib/jeko/payment-methods';
import { PaymentMethodIcon } from '@/components/payment-method-badge';
import { cn } from '@/lib/utils';

type PaymentMethodPickerProps = {
  methods: JekoPaymentMethod[];
  value: JekoPaymentMethod | null;
  onChange: (method: JekoPaymentMethod) => void;
  error?: string;
};

export function PaymentMethodPicker({
  methods,
  value,
  onChange,
  error,
}: PaymentMethodPickerProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium">Comment veux-tu payer ?</p>

      <div
        role="radiogroup"
        aria-label="Moyen de paiement"
        className="grid grid-cols-2 gap-2 sm:grid-cols-3"
      >
        {methods.map((method) => {
          const selected = value === method;
          return (
            <button
              key={method}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(method)}
              // min-h-12 : cible tactile de 48 px (WCAG 2.2, 2.5.8).
              className={cn(
                'flex min-h-12 items-center gap-2 rounded-xl border-2 px-3 py-2 text-left transition-all',
                selected
                  ? 'border-primary bg-primary/5'
                  : 'border-foreground/10 hover:border-primary/40 hover:bg-primary/5'
              )}
            >
              <PaymentMethodIcon
                mode={JEKO_TO_PAYMENT_MODE[method]}
                className={cn(
                  'h-9 w-9 shrink-0 rounded-md',
                  selected ? 'text-primary' : 'text-foreground/40'
                )}
              />
              <span
                className={cn(
                  'text-sm font-semibold leading-tight',
                  selected ? 'text-primary' : 'text-foreground'
                )}
              >
                {JEKO_PAYMENT_METHOD_LABELS[method]}
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
