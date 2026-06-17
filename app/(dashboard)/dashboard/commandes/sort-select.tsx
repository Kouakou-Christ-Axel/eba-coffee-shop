'use client';

import { Select, SelectItem } from '@heroui/react';
import { useOrdersNav } from './use-orders-nav';

const OPTIONS = [
  { key: 'recent', label: 'Plus récentes' },
  { key: 'oldest', label: 'Plus anciennes' },
  { key: 'total_desc', label: 'Montant ↓' },
  { key: 'total_asc', label: 'Montant ↑' },
  { key: 'number', label: 'N° du jour' },
] as const;

export function SortSelect({ value }: { value?: string }) {
  const { navigate } = useOrdersNav();
  const selected = value ?? 'recent';

  return (
    <Select
      aria-label="Trier les commandes"
      size="sm"
      variant="bordered"
      radius="md"
      selectedKeys={[selected]}
      disallowEmptySelection
      className="w-[160px]"
      onSelectionChange={(keys) => {
        if (keys === 'all') return;
        const next = String(Array.from(keys)[0] ?? 'recent');
        navigate((params) => {
          if (next === 'recent') params.delete('sort');
          else params.set('sort', next);
        });
      }}
    >
      {OPTIONS.map((o) => (
        <SelectItem key={o.key}>{o.label}</SelectItem>
      ))}
    </Select>
  );
}
