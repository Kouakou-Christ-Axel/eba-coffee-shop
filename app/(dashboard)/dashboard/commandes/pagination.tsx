'use client';

// Pagination de la liste des commandes : navigue via la transition partagée
// (UI réactive, scroll figé) en conservant tous les filtres et le tri courants.

import { Pagination } from '@/components/(dashboard)/pagination';
import { useOrdersNavValue } from './use-orders-nav';

export function OrdersPagination({
  page,
  totalPages,
}: {
  page: number;
  totalPages: number;
}) {
  const { navigate, isPending } = useOrdersNavValue();

  return (
    <Pagination
      page={page}
      totalPages={totalPages}
      isPending={isPending}
      onChange={(p) =>
        navigate((params) => params.set('page', String(p)), {
          keepPage: true,
        })
      }
    />
  );
}
