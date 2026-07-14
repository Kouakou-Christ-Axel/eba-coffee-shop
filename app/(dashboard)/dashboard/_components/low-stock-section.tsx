import Link from 'next/link';
import { Boxes } from 'lucide-react';
import { listLowStockItems } from '@/lib/inventory';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const stockFormatter = new Intl.NumberFormat('fr-FR');

export async function LowStockSection() {
  const lowStock = await listLowStockItems();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Stock bas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {lowStock.length > 0 ? (
          lowStock.slice(0, 5).map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3"
            >
              <span className="flex items-center gap-2 text-sm">
                <Boxes className="h-4 w-4 text-muted-foreground" />
                {item.name}
              </span>
              <span className="text-sm font-semibold tabular-nums">
                {`${stockFormatter.format(item.currentQuantity)} ${item.unit}`}
              </span>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            Aucune alerte de stock.
          </p>
        )}
        <Button asChild size="sm" variant="outline">
          <Link href="/dashboard/inventaire">
            <Boxes className="mr-1.5 h-4 w-4" />
            Voir l&apos;inventaire
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
