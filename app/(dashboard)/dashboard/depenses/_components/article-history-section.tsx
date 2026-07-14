import { getExpenseArticleHistory, listExpenseArticles } from '@/lib/expenses';
import { ArticleHistorySheet } from '../article-history-sheet';

export async function ArticleHistorySection({
  articleId,
  dateFrom,
  dateTo,
}: {
  articleId: string;
  dateFrom?: Date;
  dateTo?: Date;
}) {
  const [articleHistory, articlesFull] = await Promise.all([
    getExpenseArticleHistory(articleId, { from: dateFrom, to: dateTo }),
    listExpenseArticles(),
  ]);

  if (!articleHistory) return null;

  const articlesMeta = articlesFull.map((a) => ({
    id: a.id,
    name: a.name,
    baseUnit: a.baseUnit,
    trackInventory: a.trackInventory,
    location: a.location,
    wholesaleRefPrice: a.wholesaleRefPrice,
    itemsCount: a._count.items,
  }));

  return (
    <ArticleHistorySheet
      articleId={articleHistory.article.id}
      articleName={articleHistory.article.name}
      lines={articleHistory.lines}
      articlesMeta={articlesMeta}
    />
  );
}
