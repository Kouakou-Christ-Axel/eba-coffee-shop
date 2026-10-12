'use client';

import { useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { buildArticleAnalytics } from '@/lib/expense-article-analytics';
import { ArticleAnalyticsPanel } from './_components/article-history/article-analytics-panel';
import { priceFmt } from './_components/article-history/format';
import { HistoryLinesTable } from './_components/article-history/history-lines-table';
import type {
  ArticleHistoryLine,
  ArticleOption,
} from './_components/article-history/types';

export type { ArticleHistoryLine } from './_components/article-history/types';

/**
 * Drill-down d'un article (« farine T45 ») : chaque achat avec sa dépense.
 * Ouvert quand `?article=` est présent ; la fermeture retire le paramètre.
 * Chaque ligne peut être re-rattachée à un autre article (correction d'un
 * rapprochement erroné) via `relinkExpenseItemAction`.
 */
export function ArticleHistorySheet({
  articleId,
  articleName,
  baseUnit,
  wholesaleRefPrice,
  today,
  lines,
  articlesMeta,
}: {
  articleId: string;
  articleName: string;
  baseUnit: string | null;
  wholesaleRefPrice: number | null;
  /** Jour civil courant (YYYY-MM-DD, Abidjan) pour l'estimation de réappro. */
  today: string;
  lines: ArticleHistoryLine[];
  /** Articles actifs disponibles comme cible de re-rattachement. */
  articlesMeta: ArticleOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function close() {
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete('article');
    router.replace(sp.size > 0 ? `?${sp.toString()}` : '?', { scroll: false });
  }

  const total = lines.reduce((s, l) => s + l.amount, 0);

  const analytics = useMemo(
    () =>
      buildArticleAnalytics(
        lines.map((l) => ({
          date: l.date,
          amount: l.amount,
          qtyBase: l.qtyBase,
          supplier: l.supplier,
        })),
        today
      ),
    [lines, today]
  );

  return (
    <Sheet open onOpenChange={(open) => !open && close()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{articleName}</SheetTitle>
          <SheetDescription>
            {lines.length} achat{lines.length > 1 ? 's' : ''} sur la sélection —{' '}
            {priceFmt.format(total)} F au total.
          </SheetDescription>
        </SheetHeader>
        <ArticleAnalyticsPanel
          analytics={analytics}
          baseUnit={baseUnit}
          wholesaleRefPrice={wholesaleRefPrice}
        />
        <HistoryLinesTable
          articleId={articleId}
          articlesMeta={articlesMeta}
          lines={lines}
        />
      </SheetContent>
    </Sheet>
  );
}
