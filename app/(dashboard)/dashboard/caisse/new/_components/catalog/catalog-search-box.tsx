'use client';

import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function CatalogSearchBox({
  search,
  onChange,
}: {
  search: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative w-full">
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        type="search"
        value={search}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Rechercher un produit…"
        aria-label="Rechercher un produit"
        className="h-11 pl-8 pr-9 text-base"
      />
      {search && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onChange('')}
          aria-label="Effacer la recherche"
          className="absolute right-1 top-1/2 h-9 w-9 -translate-y-1/2"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
