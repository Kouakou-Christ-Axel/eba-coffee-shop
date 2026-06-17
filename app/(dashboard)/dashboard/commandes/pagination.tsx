'use client';

// Pagination de la liste des commandes : navigue via la transition partagée
// (UI réactive, scroll figé) en conservant tous les filtres et le tri courants.

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useOrdersNavValue } from './use-orders-nav';

export function Pagination({
  page,
  totalPages,
}: {
  page: number;
  totalPages: number;
}) {
  const { navigate, isPending } = useOrdersNavValue();

  const goTo = (p: number) =>
    navigate((params) => params.set('page', String(p)), { keepPage: true });

  return (
    <div
      aria-busy={isPending}
      className={cn(
        'flex items-center gap-3 transition-opacity',
        isPending && 'pointer-events-none opacity-60'
      )}
    >
      {page > 1 && (
        <Button variant="outline" size="sm" onClick={() => goTo(page - 1)}>
          Précédent
        </Button>
      )}
      <span className="text-sm text-muted-foreground">
        Page {page} / {totalPages}
      </span>
      {page < totalPages && (
        <Button variant="outline" size="sm" onClick={() => goTo(page + 1)}>
          Suivant
        </Button>
      )}
    </div>
  );
}
