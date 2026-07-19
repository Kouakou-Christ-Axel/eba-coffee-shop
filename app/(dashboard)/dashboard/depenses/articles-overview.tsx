'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TopArticlesChart } from '@/components/(dashboard)/charts/top-articles-chart';
import { ArticleMonthlyChart } from '@/components/(dashboard)/charts/article-monthly-chart';

export type ArticlesOverviewData = {
  /** Top articles par dépense (déjà tronqué et trié). */
  topArticles: { name: string; amount: number }[];
  /** Montant total des achats détaillés par mois (YYYY-MM). */
  monthly: { month: string; amount: number }[];
  /** Fiabilité : lignes sans quantité / total des lignes sur la sélection. */
  missingQtyLineCount: number;
  totalLineCount: number;
};

/**
 * Vue d'ensemble des achats détaillés (au-dessus du tableau des articles) :
 * top articles par dépense, tendance mensuelle, et indicateur de fiabilité
 * (part des lignes sans quantité). Ne s'affiche pas s'il n'y a aucune ligne.
 */
export function ArticlesOverview({
  data,
  periodLabel,
}: {
  data: ArticlesOverviewData;
  periodLabel: string;
}) {
  if (data.totalLineCount === 0) return null;

  const missingPct = Math.round(
    (data.missingQtyLineCount / data.totalLineCount) * 100
  );
  const monthlyData = data.monthly.map((m) => ({
    month: m.month,
    value: m.amount,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Vue d’ensemble des achats
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {periodLabel}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.missingQtyLineCount > 0 && (
          <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
            {missingPct} % des lignes d’achat sont sans quantité (
            {data.missingQtyLineCount}/{data.totalLineCount}) — renseigne-les
            pour fiabiliser les statistiques de quantité et de prix.
          </p>
        )}
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h4 className="mb-1 text-xs font-medium text-muted-foreground">
              Top articles par dépense
            </h4>
            <TopArticlesChart data={data.topArticles} />
          </div>
          <div>
            <h4 className="mb-1 text-xs font-medium text-muted-foreground">
              Achats détaillés par mois (F)
            </h4>
            <ArticleMonthlyChart
              data={monthlyData}
              label="Achats (F)"
              emptyText="Aucun achat détaillé sur la période."
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
