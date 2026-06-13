'use client';

import { useRouter, useSearchParams } from 'next/navigation';

const MODES = [
  { value: '', label: 'Tous les modes' },
  { value: 'CASH', label: 'Espèces' },
  { value: 'WAVE', label: 'Wave' },
  { value: 'OTHER', label: 'Autre' },
] as const;

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
