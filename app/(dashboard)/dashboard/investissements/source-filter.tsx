'use client';

import { useRouter, useSearchParams } from 'next/navigation';

type Source = { id: string; name: string };

const selectClass =
  'h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';

export function SourceFilter({
  sources,
  selected,
}: {
  sources: Source[];
  selected: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function onChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set('source', value);
    else params.delete('source');
    router.push(`?${params.toString()}`);
  }

  return (
    <select
      aria-label="Filtrer par source"
      className={selectClass}
      value={selected}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Toutes les sources</option>
      {sources.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}
