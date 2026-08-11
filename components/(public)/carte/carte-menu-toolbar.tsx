// components/(public)/carte/carte-menu-toolbar.tsx
'use client';

import type { RefObject } from 'react';
import { Button, Input } from '@heroui/react';
import { Search, X } from 'lucide-react';

type Props = {
  term: string;
  onTermChange: (value: string) => void;
  onlyAvailable: boolean;
  onOnlyAvailableChange: (value: boolean) => void;
  resultCount: number;
  totalCount: number;
  isFiltered: boolean;
  /** Permet aux actions de l'état vide de rendre le focus au champ. */
  inputRef: RefObject<HTMLInputElement | null>;
};

const SUMMARY_ID = 'carte-search-summary';

/**
 * Recherche et filtre de la carte, logés dans la barre collante au-dessus du
 * rail de catégories.
 *
 * Le filtre « Disponible maintenant » est un bouton à deux états
 * (`aria-pressed`) plutôt qu'un Switch : il tient dans le rail horizontal des
 * pilules, donc il ne coûte pas une ligne de plus à une barre collante déjà
 * chargée sur mobile — et il se lit comme les pilules qu'il côtoie.
 *
 * Pas de debounce : le filtrage porte sur une soixantaine d'objets déjà en
 * mémoire, la frappe est instantanée. Même raisonnement que `caisse-search.tsx`.
 */
function CarteMenuToolbar({
  term,
  onTermChange,
  onlyAvailable,
  onOnlyAvailableChange,
  resultCount,
  totalCount,
  isFiltered,
  inputRef,
}: Props) {
  return (
    <div className="pt-3">
      <Input
        ref={inputRef}
        type="search"
        value={term}
        onValueChange={onTermChange}
        placeholder="Rechercher un produit…"
        aria-label="Rechercher un produit dans la carte"
        aria-describedby={SUMMARY_ID}
        variant="bordered"
        radius="lg"
        startContent={
          <Search
            aria-hidden="true"
            className="pointer-events-none h-4 w-4 shrink-0 text-foreground/40"
          />
        }
        endContent={
          term ? (
            <button
              type="button"
              onClick={() => {
                onTermChange('');
                inputRef.current?.focus();
              }}
              aria-label="Effacer la recherche"
              className="cursor-pointer rounded-full p-1 text-foreground/50 transition-colors hover:bg-foreground/5 hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null
        }
        classNames={{
          // `text-base` (16 px) obligatoire : en dessous, iOS Safari zoome
          // automatiquement au focus et casse la mise en page.
          input: 'text-base',
          inputWrapper: 'h-11 bg-white/70 data-[hover=true]:bg-white',
        }}
      />

      {/* Live region TOUJOURS montée : une région ajoutée en même temps que son
          contenu n'est pas annoncée par les lecteurs d'écran. */}
      <p
        id={SUMMARY_ID}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {isFiltered ? `${resultCount} produits sur ${totalCount}` : ''}
      </p>

      <div className="mt-2 flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          radius="full"
          aria-pressed={onlyAvailable}
          onPress={() => onOnlyAvailableChange(!onlyAvailable)}
          className={`h-8 shrink-0 cursor-pointer px-3 text-sm font-medium ${
            onlyAvailable
              ? 'bg-secondary text-secondary-foreground'
              : 'bg-foreground/5 text-foreground/60 hover:text-foreground'
          }`}
        >
          Disponible maintenant
        </Button>

        {isFiltered && (
          <span
            aria-hidden="true"
            className="truncate text-xs text-foreground/50"
          >
            {resultCount} sur {totalCount}
          </span>
        )}
      </div>
    </div>
  );
}

export default CarteMenuToolbar;
