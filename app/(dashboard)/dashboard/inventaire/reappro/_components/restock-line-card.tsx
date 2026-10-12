'use client';

import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { f } from './restock-shared';
import type { Line } from './restock-shared';
import type { RestockForm } from './use-restock-form';

export function RestockLineCard({
  form,
  line,
  index: i,
}: {
  form: RestockForm;
  line: Line;
  index: number;
}) {
  const {
    itemMap,
    lastCosts,
    subtotal,
    lastAdded,
    setQuantityRef,
    updateLine,
    removeLine,
    focusNextQuantity,
  } = form;
  const item = itemMap.get(line.itemId);
  if (!item) return null;
  const last = lastCosts[line.itemId];
  const s = subtotal(line);

  return (
    <div key={line.itemId} className="rounded-xl border bg-card p-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-medium">{item.name}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            <span className="font-mono">{item.sku}</span>
            <span aria-hidden> · </span>
            Stock {f.format(item.currentQuantity)} {item.unit}
            {item.isLowStock && (
              <span className="ml-1.5 text-destructive">sous le seuil</span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => removeLine(line.itemId)}
          aria-label={`Retirer ${item.name}`}
          className="flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="space-y-1">
          <label
            htmlFor={`qty-${line.itemId}`}
            className="text-xs text-muted-foreground"
          >
            Quantité reçue
          </label>
          <Input
            id={`qty-${line.itemId}`}
            ref={(el) => {
              setQuantityRef(i, el);
            }}
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            className="h-11 tabular-nums"
            autoFocus={i === lastAdded}
            value={line.quantity}
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                focusNextQuantity(i);
              }
            }}
            onChange={(e) =>
              updateLine(line.itemId, { quantity: e.target.value })
            }
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor={`cost-${line.itemId}`}
            className="text-xs text-muted-foreground"
          >
            Coût unitaire (F)
          </label>
          <Input
            id={`cost-${line.itemId}`}
            type="number"
            inputMode="numeric"
            min={0}
            step="any"
            className={cn(
              'h-11 tabular-nums',
              line.costIsSuggestion && 'text-muted-foreground'
            )}
            placeholder="—"
            value={line.unitCost}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) =>
              updateLine(line.itemId, {
                unitCost: e.target.value,
                // Une saisie manuelle l'emporte définitivement.
                costIsSuggestion: false,
              })
            }
          />
        </div>

        <div className="col-span-2 flex items-end justify-between gap-2 sm:col-span-1 sm:justify-end">
          {line.costIsSuggestion && last && (
            <span className="text-xs text-muted-foreground">
              dernier achat du {last.date}
            </span>
          )}
          <span className="text-base font-semibold tabular-nums">
            {f.format(Number.isFinite(s) ? Math.round(s) : 0)} F
          </span>
        </div>
      </div>
    </div>
  );
}
