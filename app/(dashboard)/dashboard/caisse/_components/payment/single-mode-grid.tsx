'use client';

import { cn } from '@/lib/utils';
import { PAYMENT_MODES, PAYMENT_MODE_LABELS } from '@/lib/payment-modes';
import { PaymentMethodIcon } from '@/components/payment-method-badge';
import type { PaymentFormState } from './use-payment-form';

export function SingleModeGrid({
  form,
  isSubmitting,
}: {
  form: PaymentFormState;
  isSubmitting: boolean;
}) {
  const { singleSelected, selectSingleMode } = form;
  return (
    <div className="grid grid-cols-2 gap-2">
      {PAYMENT_MODES.map((value) => {
        const isActive = singleSelected === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => selectSingleMode(value)}
            disabled={isSubmitting}
            className={cn(
              'flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 px-2 py-4 text-sm font-medium transition-colors',
              isActive
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-card hover:bg-muted',
              isSubmitting && 'opacity-50'
            )}
          >
            <PaymentMethodIcon mode={value} className="h-8 w-8" />
            {PAYMENT_MODE_LABELS[value]}
          </button>
        );
      })}
    </div>
  );
}
