'use client';

// Pagination partagée du dashboard : rendu HeroUI + retour visuel de
// chargement. La navigation (routing/transition) reste à la charge de
// l'appelant, propre à chaque page (filtres, recherche, etc.).

import { Pagination as HeroPagination } from '@heroui/react';
import { cn } from '@/lib/utils';

export function Pagination({
  page,
  totalPages,
  onChange,
  isPending,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  isPending?: boolean;
}) {
  return (
    <div
      aria-busy={isPending}
      className={cn(
        'w-fit transition-opacity',
        isPending && 'pointer-events-none opacity-60'
      )}
    >
      <HeroPagination
        page={page}
        total={totalPages}
        onChange={onChange}
        color="primary"
        showControls
      />
    </div>
  );
}
