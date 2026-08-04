'use client';

import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type Props = {
  value: string;
  onChange: (value: string) => void;
};

/**
 * Champ de recherche de la caisse : code de retrait, n° du jour, nom ou
 * téléphone. Cas d'usage : un livreur arrive et annonce le numéro du client.
 *
 * Pas de debounce — contrairement à `dashboard/commandes/order-search.tsx` qui
 * déclenche une navigation serveur, on filtre ici une trentaine d'objets déjà
 * en mémoire (file du jour reçue par SSE) : le résultat est instantané.
 */
export function CaisseSearch({ value, onChange }: Props) {
  return (
    <div className="relative w-full">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Code de retrait, n°, nom ou téléphone…"
        aria-label="Rechercher une commande"
        className="h-11 pl-8 pr-9 text-base"
      />
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onChange('')}
          aria-label="Effacer la recherche"
          className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
