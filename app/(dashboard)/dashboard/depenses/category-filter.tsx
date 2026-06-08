'use client';

import { useRouter, useSearchParams } from 'next/navigation';

type Category = { id: string; name: string };

const selectClass =
  'h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';

export function CategoryFilter({
  categories,
  selected,
}: {
  categories: Category[];
  selected: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function onChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set('category', value);
    else params.delete('category');
    router.push(`?${params.toString()}`);
  }

  return (
    <select
      aria-label="Filtrer par catégorie"
      className={selectClass}
      value={selected}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Toutes les catégories</option>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
