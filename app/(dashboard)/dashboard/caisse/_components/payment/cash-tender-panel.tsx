'use client';

import { Input } from '@heroui/react';
import { cn } from '@/lib/utils';
import { suggestCashTenders } from '@/lib/cash-tender';
import { priceFormatter } from './format';
import type { PaymentFormState } from './use-payment-form';

export function CashTenderPanel({
  form,
  amount,
  isSubmitting,
}: {
  form: PaymentFormState;
  amount: number;
  isSubmitting: boolean;
}) {
  const { tendered, setTendered, change } = form;
  return (
    <div className="flex flex-col gap-2 rounded-xl border-2 border-border bg-muted/40 p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Reçu du client (facultatif)
      </p>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setTendered(amount)}
          disabled={isSubmitting}
          className={cn(
            'h-11 rounded-lg border-2 px-3 text-sm font-medium tabular-nums transition-colors',
            tendered === amount
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border bg-card hover:bg-muted'
          )}
        >
          Appoint
        </button>
        {suggestCashTenders(amount).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTendered(value)}
            disabled={isSubmitting}
            className={cn(
              'h-11 rounded-lg border-2 px-3 text-sm font-medium tabular-nums transition-colors',
              tendered === value
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-card hover:bg-muted'
            )}
          >
            {priceFormatter.format(value)}
          </button>
        ))}
      </div>
      <Input
        type="number"
        inputMode="numeric"
        size="sm"
        aria-label="Montant reçu du client"
        placeholder="Autre montant"
        value={tendered === null ? '' : String(tendered)}
        onValueChange={(v) =>
          setTendered(
            v.trim() === '' ? null : Math.max(0, Math.floor(Number(v) || 0))
          )
        }
        endContent={<span className="text-xs">F</span>}
        isDisabled={isSubmitting}
      />
      {change !== null && (
        <div className="flex items-baseline justify-between rounded-lg bg-green-50 px-3 py-2 dark:bg-green-950/40">
          <span className="text-sm font-medium text-green-900 dark:text-green-100">
            Rendre
          </span>
          <span className="text-2xl font-bold tabular-nums text-green-700 dark:text-green-300">
            {priceFormatter.format(change)} F
          </span>
        </div>
      )}
      {tendered !== null && change === null && (
        <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
          Il manque {priceFormatter.format(amount - tendered)} F
        </p>
      )}
    </div>
  );
}
