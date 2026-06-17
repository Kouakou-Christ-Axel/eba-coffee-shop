'use client';

import { Select, SelectItem } from '@heroui/react';
import { useOrdersNav } from './use-orders-nav';

const OPTIONS = [
  { key: 'all', label: 'Tous paiements' },
  { key: 'unpaid', label: 'À encaisser' },
  { key: 'CASH', label: 'Espèces' },
  { key: 'WAVE', label: 'Wave' },
  { key: 'OTHER', label: 'Autre' },
] as const;

export function PaymentFilter({ value }: { value?: string }) {
  const { navigate } = useOrdersNav();
  const selected = value ?? 'all';

  return (
    <Select
      aria-label="Filtrer par paiement"
      size="sm"
      variant="bordered"
      radius="md"
      selectedKeys={[selected]}
      disallowEmptySelection
      className="w-[160px]"
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
