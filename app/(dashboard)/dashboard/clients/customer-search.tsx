'use client';

import { Loader2, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useClientsNav } from './use-clients-nav';

const DEBOUNCE_MS = 350;

export function CustomerSearch() {
  const { filters, update, isPending } = useClientsNav();
  // État nuqs : instantané pendant la frappe, seule l'écriture dans l'URL (donc
  // la requête serveur) est différée. Aucune resynchronisation depuis le
  // serveur, sinon une réponse lente remettrait une saisie plus ancienne.
  const value = filters.search ?? '';

  return (
    <div className="relative w-full sm:w-[300px]">
      {isPending ? (
        <Loader2
          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground"
          aria-hidden="true"
        />
      ) : (
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      )}
      <Input
        type="search"
        value={value}
        onChange={(e) =>
          update(
            { search: e.target.value.trim() ? e.target.value : null },
            { debounceMs: DEBOUNCE_MS }
          )
        }
        placeholder="Nom ou téléphone…"
        aria-label="Rechercher un client"
        className="pl-8 pr-10 h-9"
      />
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => update({ search: null })}
          aria-label="Effacer la recherche"
          className="absolute right-0 top-1/2 h-9 w-9 -translate-y-1/2"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
