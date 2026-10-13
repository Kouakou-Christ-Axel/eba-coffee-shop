import { Badge } from '@/components/ui/badge';
import { priceFmt, qtyFmt } from './format';
import type { ExpenseItemRow } from './types';

export function ExpenseItemDetails({ items }: { items: ExpenseItemRow[] }) {
  return (
    <ul className="space-y-1 text-sm">
      {items.map((item) => (
        <li key={item.id} className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-medium">
            {item.articleName ?? item.rawLabel}
          </span>
          {item.label && (
            <span className="text-muted-foreground">{item.label}</span>
          )}
          {item.pendingQuantity && (
            <Badge variant="outline" className="text-[10px]">
              qté à renseigner
            </Badge>
          )}
          <span className="text-muted-foreground">
            {item.formatQty != null
              ? `${qtyFmt.format(item.formatQty)}${
                  item.formatSize ? ` × ${qtyFmt.format(item.formatSize)}` : ''
                } ${item.unit ?? ''}`.trim()
              : ''}
            {item.formatQty != null &&
              item.unitPrice != null &&
              ` × ${priceFmt.format(item.unitPrice)} F`}
          </span>
          <span className="ml-auto font-medium tabular-nums">
            {priceFmt.format(item.amount)} F
          </span>
        </li>
      ))}
    </ul>
  );
}
