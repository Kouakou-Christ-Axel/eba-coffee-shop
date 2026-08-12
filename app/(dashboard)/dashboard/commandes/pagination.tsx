'use client';

// Pagination de la liste des commandes : navigue via la transition partagée
// (UI réactive, scroll figé) en conservant tous les filtres et le tri courants.

import { Pagination as HeroPagination } from '@heroui/react';
import { cn } from '@/lib/utils';
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
        'transition-opacity',
        isPending && 'pointer-events-none opacity-60'
      )}
    >
      <HeroPagination
        page={page}
        total={totalPages}
        onChange={goTo}
        color="primary"
        showControls
      />
    </div>
  );
}
