import { Download, ReceiptText, Scale } from 'lucide-react';
import type { PaymentMode } from '@/generated/prisma/client';
import { requireRoleOrAnalyst } from '@/lib/auth-helpers';
import { listRevenueAdjustments } from '@/lib/revenue-adjustments';
import {
  parseDateOnlyToUTC,
  todayDateString,
  shiftDateString,
  formatLocalDateOnly,
} from '@/lib/timezone';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DateRangeFilter } from '@/components/(dashboard)/date-range-filter';
import {
  RevenueAdjustmentsTable,
  type RevenueAdjustmentRow,
} from './revenue-adjustments-table';
import { ModeFilter } from './mode-filter';

export const dynamic = 'force-dynamic';

const DEFAULT_RANGE_DAYS = 30;
const priceFmt = new Intl.NumberFormat('fr-FR');

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Espèces',
  WAVE: 'Wave',
  ORANGE_MONEY: 'Orange Money',
  OTHER: 'Autre',
};

const MODES = ['CASH', 'WAVE', 'ORANGE_MONEY', 'OTHER'] as const;

function formatSigned(amount: number): string {
  const sign = amount < 0 ? '−' : '+';
  return `${sign}${priceFmt.format(Math.abs(amount))} F`;
}

export default async function RegularisationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    range?: string;
    mode?: string;
  }>;
}) {
  await requireRoleOrAnalyst(['ADMIN']);
  const params = await searchParams;

  const isAll = params.range === 'all';
  const today = todayDateString();
  const defaultFrom = shiftDateString(today, -(DEFAULT_RANGE_DAYS - 1));
  let fromStr = '';
  let toStr = '';
  let dateFrom: Date | undefined;
  let dateTo: Date | undefined;
  if (!isAll) {
    fromStr = parseDateOnlyToUTC(params.from) ? params.from! : defaultFrom;
    toStr = parseDateOnlyToUTC(params.to) ? params.to! : today;
    if (fromStr > toStr) [fromStr, toStr] = [toStr, fromStr];
    dateFrom = parseDateOnlyToUTC(fromStr);
    dateTo = parseDateOnlyToUTC(toStr);
  }

  const paymentMode = MODES.includes(params.mode as PaymentMode)
    ? (params.mode as PaymentMode)
    : undefined;

  const { adjustments, total, count } = await listRevenueAdjustments({
    dateFrom,
    dateTo,
    paymentMode,
  });

  const exportSp = new URLSearchParams();
  if (isAll) exportSp.set('range', 'all');
  else {
    exportSp.set('from', fromStr);
    exportSp.set('to', toStr);
  }
  if (paymentMode) exportSp.set('mode', paymentMode);
  const exportHref = `/api/export/revenue-adjustments?${exportSp.toString()}`;

  const rows: RevenueAdjustmentRow[] = adjustments.map((a) => ({
    id: a.id,
    date: formatLocalDateOnly(a.date),
    amount: a.amount,
    paymentLabel: PAYMENT_LABELS[a.paymentMode] ?? a.paymentMode,
    paymentMode: a.paymentMode,
    note: a.note,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Régularisations de recette</h1>
        <p className="text-sm text-muted-foreground">
          Ajuste le CA pour des ventes non saisies en temps réel (anciennes
          commandes, encaissements différés…), sans créer de commande. Compté
          dans les statistiques et la clôture de caisse.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Kpi
          label="Total net période"
          value={formatSigned(total)}
          Icon={Scale}
          valueClassName={total < 0 ? 'text-destructive' : undefined}
        />
        <Kpi label="Nombre" value={priceFmt.format(count)} Icon={ReceiptText} />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">
            Historique
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {isAll ? 'Tout l’historique' : `Du ${fromStr} au ${toStr}`}
            </span>
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <ModeFilter selected={paymentMode ?? ''} />
            <DateRangeFilter from={fromStr} to={toStr} isAll={isAll} />
            <Button asChild variant="outline" size="sm">
              <a href={exportHref}>
                <Download className="mr-1.5 h-4 w-4" />
                Exporter CSV
              </a>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <RevenueAdjustmentsTable adjustments={rows} total={total} />
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({
  label,
  value,
  Icon,
  valueClassName,
}: {
  label: string;
  value: string;
  Icon: typeof Scale;
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
      <p className={cn('mt-2 text-2xl font-bold tabular-nums', valueClassName)}>
        {value}
      </p>
    </div>
  );
}
