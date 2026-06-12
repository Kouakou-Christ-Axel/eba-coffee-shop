import {
  Download,
  Landmark,
  PiggyBank,
  ReceiptText,
  Wallet,
} from 'lucide-react';
import { requireAdmin } from '@/lib/auth-helpers';
import { listInvestments, listInvestmentSources } from '@/lib/investments';
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
import { InvestmentsBySourceChart } from '@/components/(dashboard)/charts/investments-by-source-chart';
import { InvestmentsTable, type InvestmentRow } from './investments-table';
import { SourceFilter } from './source-filter';

export const dynamic = 'force-dynamic';

const DEFAULT_RANGE_DAYS = 30;
const priceFmt = new Intl.NumberFormat('fr-FR');

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Espèces',
  WAVE: 'Wave',
  BANK: 'Banque',
  OTHER: 'Autre',
};

export default async function InvestissementsPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    range?: string;
    source?: string;
  }>;
}) {
  await requireAdmin();
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

  const sourceId = params.source || undefined;

  const [sources, { investments, total, totalOutstanding, count }] =
    await Promise.all([
      listInvestmentSources(),
      listInvestments({ dateFrom, dateTo, sourceId }),
    ]);

  // Ventilation par source (sur la sélection courante) pour le graphique + KPI.
  const bySourceMap = new Map<string, number>();
  for (const i of investments) {
    bySourceMap.set(i.sourceId, (bySourceMap.get(i.sourceId) ?? 0) + i.amount);
  }
  const bySource = sources
    .map((s) => ({ name: s.name, amount: bySourceMap.get(s.id) ?? 0 }))
    .filter((s) => s.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const topSource = bySource[0];

  const exportSp = new URLSearchParams();
  if (isAll) exportSp.set('range', 'all');
  else {
    exportSp.set('from', fromStr);
    exportSp.set('to', toStr);
  }
  if (sourceId) exportSp.set('source', sourceId);
  const exportHref = `/api/export/investments?${exportSp.toString()}`;

  const rows: InvestmentRow[] = investments.map((i) => ({
    id: i.id,
    date: formatLocalDateOnly(i.date),
    amount: i.amount,
    paymentLabel: PAYMENT_LABELS[i.paymentMethod] ?? i.paymentMethod,
    paymentMethod: i.paymentMethod,
    sourceId: i.sourceId,
    sourceName: i.source.name,
    financier: i.financier,
    note: i.note,
    documentUrl: i.documentUrl,
    reimbursable: i.reimbursable,
    amountRepaid: i.amountRepaid,
    outstanding: i.reimbursable ? Math.max(0, i.amount - i.amountRepaid) : 0,
    dueDate: i.dueDate ? formatLocalDateOnly(i.dueDate) : null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Investissements</h1>
        <p className="text-sm text-muted-foreground">
          Apports et financements injectés dans l’affaire (capital, prêts,
          apports d’associés…). Distincts des dépenses d’exploitation.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="Total investi"
          value={`${priceFmt.format(total)} F`}
          Icon={PiggyBank}
        />
        <Kpi
          label="Restant dû"
          value={`${priceFmt.format(totalOutstanding)} F`}
          Icon={Landmark}
          valueClassName={totalOutstanding > 0 ? 'text-amber-600' : undefined}
        />
        <Kpi
          label="Nombre d’apports"
          value={priceFmt.format(count)}
          Icon={ReceiptText}
        />
        <Kpi
          label="Top source"
          value={topSource ? topSource.name : '—'}
          hint={
            topSource ? `${priceFmt.format(topSource.amount)} F` : undefined
          }
          Icon={Wallet}
        />
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
            <SourceFilter sources={sources} selected={sourceId ?? ''} />
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
          <InvestmentsTable
            investments={rows}
            sources={sources}
            total={total}
            totalOutstanding={totalOutstanding}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Apports par source</CardTitle>
        </CardHeader>
        <CardContent>
          <InvestmentsBySourceChart data={bySource} />
        </CardContent>
      </Card>
    </div>
  );
}

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
  Icon: typeof PiggyBank;
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
        className={cn(
          'mt-2 truncate text-2xl font-bold tabular-nums',
          valueClassName
        )}
      >
        {value}
      </p>
      {hint && (
        <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
          {hint}
        </p>
      )}
    </div>
  );
}
