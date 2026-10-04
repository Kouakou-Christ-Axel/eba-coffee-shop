'use client';

import { Select, SelectItem } from '@heroui/react';
import { PAYMENT_MODES, PAYMENT_MODE_LABELS } from '@/lib/payment-modes';
import { useOrdersNav } from './use-orders-nav';

const OPTIONS = [
  { key: 'all', label: 'Tous paiements' },
  { key: 'unpaid', label: 'À encaisser' },
  ...PAYMENT_MODES.map((m) => ({ key: m, label: PAYMENT_MODE_LABELS[m] })),
];

export function PaymentFilter({ value }: { value?: string }) {
  const { navigate } = useOrdersNav();
  const selected = value ?? 'all';

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
        navigate((params) => {
          if (next === 'all') params.delete('payment');
          else params.set('payment', next);
        });
      }}
    >
      {OPTIONS.map((o) => (
        <SelectItem key={o.key}>{o.label}</SelectItem>
      ))}
    </Select>
  );
}
