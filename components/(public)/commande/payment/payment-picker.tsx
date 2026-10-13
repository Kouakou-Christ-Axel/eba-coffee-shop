'use client';

import { Button } from '@heroui/react';
import { priceFormatter } from '@/config/menu';
import { JEKO_PAYMENT_METHODS } from '@/lib/jeko/payment-methods';
import { PaymentMethodPicker } from '@/components/(public)/carte/_components/payment-method-picker';
import type { PaymentSectionState } from './use-payment-section';

export function PaymentPicker({ payment }: { payment: PaymentSectionState }) {
  const {
    method,
    setMethod,
    error,
    setError,
    starting,
    pay,
    amountDue,
    onlineFee,
  } = payment;
  return (
    <div className="mt-4 flex flex-col gap-3">
      <PaymentMethodPicker
        methods={[...JEKO_PAYMENT_METHODS]}
        value={method}
        onChange={(mth) => {
          setMethod(mth);
          setError(null);
        }}
      />
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <Button
        color="primary"
        size="lg"
        className="w-full"
        isLoading={starting}
        isDisabled={starting}
        onPress={() => void pay()}
      >
        Payer {priceFormatter.format(amountDue)} F
      </Button>
      {onlineFee != null && onlineFee > 0 && (
        <p className="text-center text-xs text-foreground/50">
          Dont {priceFormatter.format(onlineFee)} F de frais de paiement en
          ligne.
        </p>
      )}
    </div>
  );
}
