'use client';

import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const PAYMENT_METHODS = [
  { value: '', label: 'Tous les paiements' },
  { value: 'CASH', label: 'Espèces' },
  { value: 'WAVE', label: 'Wave' },
  { value: 'BANK', label: 'Banque' },
  { value: 'OTHER', label: 'Autre' },
] as const;

const selectClass =
  'h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';

/** Filtre mode de paiement (URL `payment`) + recherche texte (URL `search`). */
export function ExpenseFilters({
  payment,
  search,
}: {
  payment: string;
  search: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(search);

  function pushParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Filtrer par mode de paiement"
        className={selectClass}
        value={payment}
        onChange={(e) => pushParam('payment', e.target.value)}
      >
        {PAYMENT_METHODS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>

      <form
        className="flex items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          pushParam('search', query.trim());
        }}
      >
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Fournisseur, note…"
            aria-label="Rechercher une dépense"
            className="h-9 w-44 pl-8"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                pushParam('search', '');
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Effacer la recherche"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button type="submit" variant="outline" size="sm">
          Rechercher
        </Button>
      </form>
    </div>
  );
}
