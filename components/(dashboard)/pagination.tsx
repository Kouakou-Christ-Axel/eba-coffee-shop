'use client';

// Pagination générique du dashboard, branchée sur l'URL via nuqs (`?page=`).
// Elle pilote elle-même la navigation : les autres paramètres sont conservés
// par nuqs, et `shallow: false` relance le rendu serveur de la page (c'est lui
// qui relit la base). Transition dédiée pour rester réactive sans sauter le
// scroll.

import { useTransition } from 'react';
import { useQueryState } from 'nuqs';
import { Pagination as HeroPagination } from '@heroui/react';
import { cn } from '@/lib/utils';
import { pageParser } from '@/lib/url-state/shared-params';

export function Pagination({ totalPages }: { totalPages: number }) {
  const [isPending, startTransition] = useTransition();
  const [page, setPage] = useQueryState(
    'page',
    pageParser.withOptions({
      shallow: false,
      history: 'push',
      scroll: false,
      startTransition,
    })
  );

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
        onChange={(p) => void setPage(p)}
        color="primary"
        showControls
      />
    </div>
  );
}
