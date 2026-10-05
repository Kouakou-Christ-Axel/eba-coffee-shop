'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { PAYMENT_MODES, PAYMENT_MODE_LABELS } from '@/lib/payment-modes';

const MODES = [
  { value: '', label: 'Tous les modes' },
  ...PAYMENT_MODES.map((m) => ({ value: m, label: PAYMENT_MODE_LABELS[m] })),
];

const selectClass =
  'h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';

export function ModeFilter({ selected }: { selected: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function onChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set('mode', value);
    else params.delete('mode');
    router.push(`?${params.toString()}`);
  }

  return (
    <select
      aria-label="Filtrer par mode de paiement"
      className={selectClass}
      value={selected}
      onChange={(e) => onChange(e.target.value)}
    >
      {MODES.map((m) => (
        <option key={m.value} value={m.value}>
          {m.label}
        </option>
      ))}
    </select>
  );
}
