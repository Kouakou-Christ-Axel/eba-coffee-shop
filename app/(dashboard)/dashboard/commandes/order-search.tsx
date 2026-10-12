'use client';

import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useOrdersNav } from './use-orders-nav';

const DEBOUNCE_MS = 350;

export function OrderSearch() {
  const { filters, update } = useOrdersNav();
  // L'état nuqs est mis à jour immédiatement ; seule l'écriture dans l'URL
  // (donc la requête serveur) est différée.
  const value = filters.search ?? '';

  return (
    <div className="relative w-full sm:w-[280px]">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={value}
        onChange={(e) =>
          update(
            { search: e.target.value.trim() ? e.target.value : null },
            { debounceMs: DEBOUNCE_MS }
          )
        }
        placeholder="N°, référence, nom ou téléphone…"
        className="pl-8 pr-8 h-9"
      />
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => update({ search: null })}
          aria-label="Effacer la recherche"
          className="absolute right-0.5 top-1/2 h-7 w-7 -translate-y-1/2"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
