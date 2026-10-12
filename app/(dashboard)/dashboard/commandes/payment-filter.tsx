'use client';

import { Select, SelectItem } from '@heroui/react';
import { PAYMENT_MODES, PAYMENT_MODE_LABELS } from '@/lib/payment-modes';
import { PaymentMethodIcon } from '@/components/payment-method-badge';
import type { PaymentMode } from '@/generated/prisma/client';
import { useOrdersNav, type OrdersFilters } from './use-orders-nav';

const OPTIONS = [
  { key: 'all', label: 'Tous paiements' },
  { key: 'unpaid', label: 'À encaisser' },
  ...PAYMENT_MODES.map((m) => ({ key: m, label: PAYMENT_MODE_LABELS[m] })),
];

export function PaymentFilter() {
  const { filters, update } = useOrdersNav();
  const selected = filters.payment ?? 'all';

  return (
    <Select
      id="orders-payment-filter"
      aria-label="Filtrer par paiement"
      size="sm"
      variant="bordered"
      radius="md"
      selectedKeys={[selected]}
      disallowEmptySelection
      className="w-full min-w-0 sm:w-[160px]"
      onSelectionChange={(keys) => {
        if (keys === 'all') return;
        const next = String(Array.from(keys)[0] ?? 'all');
        update({
          payment: next === 'all' ? null : (next as OrdersFilters['payment']),
        });
      }}
    >
      {OPTIONS.map((o) => (
        <SelectItem
          key={o.key}
          startContent={
            o.key === 'all' || o.key === 'unpaid' ? undefined : (
              <PaymentMethodIcon
                mode={o.key as PaymentMode}
                className="h-4 w-4"
              />
            )
          }
        >
          {o.label}
        </SelectItem>
      ))}
    </Select>
  );
}
