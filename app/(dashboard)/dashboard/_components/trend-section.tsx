// Tendance CA — 7 derniers jours (jour courant inclus). La date de fin est
// dérivée localement (`todayDailyDate()`, pur/sync) plutôt que d'attendre le
// résultat de `compareDays()` (today-kpis-section) : élimine la waterfall
// signalée en Phase 1.3 (dashboard/page.tsx:47-56 dans le plan).

import { getDailySeries } from '@/lib/stats';
import { todayDailyDate } from '@/lib/daily-numbering';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RevenueTrendChart } from '@/components/(dashboard)/charts/revenue-trend-chart';

export async function TrendSection() {
  const today = todayDailyDate();
  const seriesFrom = new Date(today.getTime());
  seriesFrom.setUTCDate(seriesFrom.getUTCDate() - 6);
  const series = await getDailySeries(seriesFrom, today);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tendance — 7 derniers jours</CardTitle>
      </CardHeader>
      <CardContent>
        <RevenueTrendChart data={series} />
      </CardContent>
    </Card>
  );
}
