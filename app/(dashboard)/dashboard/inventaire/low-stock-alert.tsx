'use client';

import { AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { InventoryItemView } from '@/lib/inventory';

const f = new Intl.NumberFormat('fr-FR');
const CAP = 12;

export function LowStockAlert({ items }: { items: InventoryItemView[] }) {
  if (items.length === 0) return null;

  const shown = items.slice(0, CAP);
  const rest = items.length - shown.length;

  return (
    <Card className="border-amber-300 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
          <AlertTriangle className="h-5 w-5" />
          Stock bas ({items.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {shown.map((item) => (
            <Badge
              key={item.id}
              variant="outline"
              className="border-amber-300 bg-white/70 text-amber-900 dark:border-amber-800 dark:bg-transparent dark:text-amber-200"
            >
              {item.name} — {f.format(item.currentQuantity)} {item.unit}
            </Badge>
          ))}
          {rest > 0 && (
            <Badge
              variant="outline"
              className="border-amber-300 text-amber-900 dark:border-amber-800 dark:text-amber-200"
            >
              +{rest} autres
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
