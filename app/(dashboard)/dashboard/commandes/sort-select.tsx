'use client';

import { Select, SelectItem } from '@heroui/react';
import { useOrdersNav, type OrdersFilters } from './use-orders-nav';

const OPTIONS = [
  { key: 'recent', label: 'Plus récentes' },
  { key: 'oldest', label: 'Plus anciennes' },
  { key: 'total_desc', label: 'Montant ↓' },
  { key: 'total_asc', label: 'Montant ↑' },
  { key: 'number', label: 'N° du jour' },
] as const;

export function SortSelect() {
  const { filters, update } = useOrdersNav();
  const selected = filters.sort;

  return (
    <Select
      id="orders-sort-select"
      aria-label="Trier les commandes"
      size="sm"
      variant="bordered"
      radius="md"
      selectedKeys={[selected]}
      disallowEmptySelection
      className="w-full min-w-0 sm:w-[160px]"
      onSelectionChange={(keys) => {
        if (keys === 'all') return;
        const next = String(Array.from(keys)[0] ?? 'recent');
        update({ sort: next as OrdersFilters['sort'] });
      }}
    >
      {OPTIONS.map((o) => (
        <SelectItem key={o.key}>{o.label}</SelectItem>
      ))}
    </Select>
  );
}
