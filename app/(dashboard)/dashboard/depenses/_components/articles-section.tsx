import { Download } from 'lucide-react';
import { getExpenseArticleStats, listExpenseArticles } from '@/lib/expenses';
import { listInventoryItems } from '@/lib/inventory';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArticlesTable } from '../articles-table';

export async function ArticlesSection({
  dateFrom,
  dateTo,
  categoryId,
  paymentMethod,
  search,
  periodLabel,
  exportItemsHref,
}: {
  dateFrom?: Date;
  dateTo?: Date;
  categoryId?: string;
  paymentMethod?: 'CASH' | 'WAVE' | 'BANK' | 'OTHER';
  search?: string;
  periodLabel: string;
  exportItemsHref: string;
}) {
  const [articleStats, articlesFull, inventoryItems] = await Promise.all([
    getExpenseArticleStats({
      from: dateFrom,
      to: dateTo,
      categoryId,
      paymentMethod,
      search,
    }),
    listExpenseArticles(),
    listInventoryItems(),
  ]);

  const articlesMeta = articlesFull.map((a) => ({
    id: a.id,
    name: a.name,
    baseUnit: a.baseUnit,
    trackInventory: a.trackInventory,
    inventoryItemId: a.inventoryItemId,
    location: a.location,
    wholesaleRefPrice: a.wholesaleRefPrice,
    itemsCount: a._count.items,
  }));

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base">
          Fréquence d’achat par article
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {periodLabel}
          </span>
        </CardTitle>
        <Button asChild variant="outline" size="sm">
          <a href={exportItemsHref}>
            <Download className="mr-1.5 h-4 w-4" />
            Exporter le détail CSV
          </a>
        </Button>
      </CardHeader>
      <CardContent>
        <ArticlesTable
          stats={articleStats}
          articlesMeta={articlesMeta}
          inventoryItems={inventoryItems.map((i) => ({
            id: i.id,
            name: i.name,
            sku: i.sku,
            unit: i.unit,
          }))}
        />
      </CardContent>
    </Card>
  );
}
