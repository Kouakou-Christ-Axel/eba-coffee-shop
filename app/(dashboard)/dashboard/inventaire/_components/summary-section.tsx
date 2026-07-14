import { AlertTriangle, Boxes, ClipboardList, Coins } from 'lucide-react';
import { getInventorySummary, getDaysSinceLastCount } from '@/lib/inventory';
import { Card, CardContent } from '@/components/ui/card';

const priceFmt = new Intl.NumberFormat('fr-FR');

function Kpi({
  label,
  value,
  hint,
  Icon,
  valueClassName,
}: {
  label: string;
  value: string;
  hint?: string;
  Icon: typeof Boxes;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p
        className={`mt-2 truncate text-2xl font-bold tabular-nums ${valueClassName ?? ''}`}
      >
        {value}
      </p>
      {hint && (
        <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

export async function SummarySection() {
  const [summary, daysSince] = await Promise.all([
    getInventorySummary(),
    getDaysSinceLastCount(),
  ]);

  return (
    <>
      {daysSince !== null && daysSince > 7 && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
            <p className="text-sm font-medium text-destructive">
              Dernier inventaire il y a {daysSince} jours — pensez à enregistrer
              un comptage.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="Références actives"
          value={priceFmt.format(summary.activeCount)}
          Icon={Boxes}
        />
        <Kpi
          label="Sous le seuil"
          value={priceFmt.format(summary.lowStockCount)}
          Icon={AlertTriangle}
          valueClassName={
            summary.lowStockCount > 0 ? 'text-destructive' : undefined
          }
        />
        <Kpi
          label="Valeur du stock"
          value={`${priceFmt.format(summary.stockValue)} F`}
          Icon={Coins}
        />
        <Kpi
          label="Jamais compté"
          value={priceFmt.format(summary.neverCounted)}
          Icon={ClipboardList}
        />
      </div>
    </>
  );
}
