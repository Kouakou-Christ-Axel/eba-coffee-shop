// components/(dashboard)/stock-badge.tsx
//
// Badge de stock partagé (produit ou option) : `null` = illimité, `0` =
// épuisé, sinon la quantité restante (avertissement visuel sous le seuil bas).
// Utilisé par `products-table.tsx` et la vue consolidée
// `dashboard/menu/stock-supplements`.

import { Badge } from '@/components/ui/badge';
import { LOW_STOCK_THRESHOLD } from '@/config/constants';

export function StockBadge({
  stockQuantity,
}: {
  stockQuantity: number | null;
}) {
  if (stockQuantity === null) {
    return <Badge variant="outline">Illimité</Badge>;
  }
  if (stockQuantity === 0) {
    return <Badge variant="destructive">Épuisé</Badge>;
  }
  return (
    <Badge
      variant="outline"
      className={
        stockQuantity <= LOW_STOCK_THRESHOLD
          ? 'border-amber-400 text-amber-700 dark:text-amber-400'
          : undefined
      }
    >
      {stockQuantity}
    </Badge>
  );
}
