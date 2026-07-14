import { getDailySeries } from '@/lib/stats';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RevenueTrendChart } from '@/components/(dashboard)/charts/revenue-trend-chart';

export async function RevenueTrendSection({
  from,
  to,
}: {
  from: Date;
  to: Date;
}) {
  const series = await getDailySeries(from, to);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Chiffre d&apos;affaires & commandes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <RevenueTrendChart data={series} />
      </CardContent>
    </Card>
  );
}
