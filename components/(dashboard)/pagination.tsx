'use client';

// Pagination générique du dashboard : pilote elle-même la navigation
// (met à jour `page` dans l'URL en conservant les autres paramètres),
// via une transition dédiée pour rester réactive sans sauter le scroll.

import { useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Pagination as HeroPagination } from '@heroui/react';
import { cn } from '@/lib/utils';

export function Pagination({
  page,
  totalPages,
}: {
  page: number;
  totalPages: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function goTo(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(p));
    startTransition(() => {
      router.push(`?${params.toString()}`, { scroll: false });
    });
  }

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
        onChange={goTo}
        color="primary"
        showControls
      />
    </div>
  );
}
