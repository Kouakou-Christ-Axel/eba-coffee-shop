import { Landmark, PiggyBank } from 'lucide-react';
import { getInvestmentSummary } from '@/lib/investments';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KpiCard } from '@/components/(dashboard)/kpi-card';
import { InvestmentsBySourceChart } from '@/components/(dashboard)/charts/investments-by-source-chart';

const priceFormatter = new Intl.NumberFormat('fr-FR');

// Investissements (apports/financements) — bloc séparé, n'entre pas dans la
// marge nette d'exploitation.
export async function InvestmentsSection({
  from,
  to,
}: {
  from: Date;
  to: Date;
}) {
  const investmentSummary = await getInvestmentSummary(from, to);

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Investissements</h2>
        <p className="text-sm text-muted-foreground">
          Apports et financements injectés sur la période. Hors marge nette
          d’exploitation.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <KpiCard
          label="Total investi"
          value={`${priceFormatter.format(investmentSummary.total)} F`}
          Icon={PiggyBank}
        />
        <KpiCard
          label="Restant dû"
          value={`${priceFormatter.format(investmentSummary.totalOutstanding)} F`}
          Icon={Landmark}
          valueClassName={
            investmentSummary.totalOutstanding > 0
              ? 'text-amber-600'
              : undefined
          }
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Apports par source</CardTitle>
        </CardHeader>
        <CardContent>
          <InvestmentsBySourceChart data={investmentSummary.bySource} />
        </CardContent>
      </Card>
    </div>
  );
}
