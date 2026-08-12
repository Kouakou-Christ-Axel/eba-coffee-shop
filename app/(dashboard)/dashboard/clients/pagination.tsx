'use client';

// Pagination de la liste des clients : conserve la recherche courante
// (`search`) tout en changeant de page.

import { useRouter, useSearchParams } from 'next/navigation';
import { Pagination } from '@/components/(dashboard)/pagination';

export function ClientsPagination({
  page,
  totalPages,
}: {
  page: number;
  totalPages: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function goTo(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(p));
    router.push(`?${params.toString()}`);
  }

  return <Pagination page={page} totalPages={totalPages} onChange={goTo} />;
}
