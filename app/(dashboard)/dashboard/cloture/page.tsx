import { Download } from 'lucide-react';
import { requireCashier } from '@/lib/auth-helpers';
import {
  getCashFigures,
  getCashClosing,
  listCashClosings,
} from '@/lib/cash-closing';
import {
  parseDateOnlyToUTC,
  todayDateString,
  shiftDateString,
  formatLocalDateOnly,
  ABIDJAN_TZ,
} from '@/lib/timezone';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DateRangeFilter } from '@/components/(dashboard)/date-range-filter';
import { ClosingDatePicker } from './closing-date-picker';
import { ClosingForm } from './closing-form';

export const dynamic = 'force-dynamic';

const fmt = new Intl.NumberFormat('fr-FR');
const DEFAULT_HISTORY_DAYS = 30;

const dateTimeFmt = new Intl.DateTimeFormat('fr-FR', {
  timeZone: ABIDJAN_TZ,
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

export default async function CloturePage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    from?: string;
    to?: string;
    range?: string;
  }>;
}) {
  await requireCashier();
  const params = await searchParams;

  // Jour à clôturer.
  const dayStr = parseDateOnlyToUTC(params.date)
    ? params.date!
    : todayDateString();
  const day = parseDateOnlyToUTC(dayStr)!;

  // Plage de l'historique.
  const today = todayDateString();
  const isAll = params.range === 'all';
  let histFrom = '';
  let histTo = '';
  let histFromDate: Date | undefined;
  let histToDate: Date | undefined;
  if (!isAll) {
    histFrom = parseDateOnlyToUTC(params.from)
      ? params.from!
      : shiftDateString(today, -(DEFAULT_HISTORY_DAYS - 1));
    histTo = parseDateOnlyToUTC(params.to) ? params.to! : today;
    if (histFrom > histTo) [histFrom, histTo] = [histTo, histFrom];
    histFromDate = parseDateOnlyToUTC(histFrom);
    histToDate = parseDateOnlyToUTC(histTo);
  }

  const [figures, existing, history] = await Promise.all([
    getCashFigures(day),
    getCashClosing(day),
    listCashClosings(
      histFromDate ?? parseDateOnlyToUTC('2000-01-01')!,
      histToDate ?? parseDateOnlyToUTC(today)!
    ),
  ]);

  const existingProp = existing
    ? {
        openingFloat: existing.openingFloat,
        countedCash: existing.countedCash,
        note: existing.note,
        closedByLabel:
          existing.closedBy?.name ?? existing.closedBy?.email ?? null,
        updatedAt: dateTimeFmt.format(existing.updatedAt).replace(',', ''),
      }
    : null;

  const exportSp = new URLSearchParams();
  if (isAll) exportSp.set('range', 'all');
  else {
    exportSp.set('from', histFrom);
    exportSp.set('to', histTo);
  }
  const exportHref = `/api/export/cash-closings?${exportSp.toString()}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Clôture de caisse</h1>
          <p className="text-sm text-muted-foreground">
            Réconciliation des espèces, jour par jour.
          </p>
        </div>
        <ClosingDatePicker date={dayStr} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Clôture du {dayStr}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Pour information (hors tiroir) */}
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
            <span>
              CA encaissé : <b>{fmt.format(figures.totalRevenue)} F</b>
            </span>
            <span>Wave : {fmt.format(figures.waveSales)} F</span>
            <span>Autre : {fmt.format(figures.otherSales)} F</span>
          </div>
          <ClosingForm
            date={dayStr}
            cashSales={figures.cashSales}
            cashExpenses={figures.cashExpenses}
            existing={existingProp}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">
            Historique des clôtures
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {isAll ? 'Tout' : `Du ${histFrom} au ${histTo}`}
            </span>
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <DateRangeFilter from={histFrom} to={histTo} isAll={isAll} />
            <Button asChild variant="outline" size="sm">
              <a href={exportHref}>
                <Download className="mr-1.5 h-4 w-4" />
                Exporter CSV
              </a>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Fond</TableHead>
                <TableHead>Ventes esp.</TableHead>
                <TableHead>Dépenses esp.</TableHead>
                <TableHead>Théorique</TableHead>
                <TableHead>Compté</TableHead>
                <TableHead>Écart</TableHead>
                <TableHead>Par</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-sm">
                    {formatLocalDateOnly(c.date)}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {fmt.format(c.openingFloat)}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {fmt.format(c.cashSales)}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {fmt.format(c.cashExpenses)}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {fmt.format(c.expectedCash)}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {fmt.format(c.countedCash)}
                  </TableCell>
                  <TableCell
                    className={
                      c.difference === 0
                        ? 'tabular-nums'
                        : c.difference > 0
                          ? 'tabular-nums text-green-600'
                          : 'tabular-nums text-destructive'
                    }
                  >
                    {c.difference > 0 ? '+' : ''}
                    {fmt.format(c.difference)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {c.closedBy?.name ?? c.closedBy?.email ?? '—'}
                  </TableCell>
                </TableRow>
              ))}
              {history.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    Aucune clôture sur cette période.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
