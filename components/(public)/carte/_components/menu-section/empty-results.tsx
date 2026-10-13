import { Button } from '@heroui/react';

export function EmptyResults({
  hasSearchTerm,
  term,
  onClearSearch,
  onResetFilters,
}: {
  hasSearchTerm: boolean;
  term: string;
  onClearSearch: () => void;
  onResetFilters: () => void;
}) {
  return (
    <div className="py-10 text-center">
      <p className="text-base font-semibold text-foreground">
        {hasSearchTerm
          ? `Aucun produit ne correspond à « ${term.trim()} ».`
          : 'Aucun produit disponible pour le moment.'}
      </p>
      <p className="mt-1 text-sm text-foreground/60">
        Essayez un autre mot, ou parcourez la carte complète.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {hasSearchTerm && (
          <Button
            radius="full"
            variant="bordered"
            className="cursor-pointer"
            onPress={onClearSearch}
          >
            Effacer la recherche
          </Button>
        )}
        <Button
          radius="full"
          color="primary"
          className="cursor-pointer"
          onPress={onResetFilters}
        >
          Voir toute la carte
        </Button>
      </div>
    </div>
  );
}
