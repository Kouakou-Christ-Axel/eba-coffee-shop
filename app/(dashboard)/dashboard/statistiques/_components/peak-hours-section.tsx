import { getHourlyDistribution } from '@/lib/stats-operations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PeakHoursChart } from '@/components/(dashboard)/charts/peak-hours-chart';

export async function PeakHoursSection({ from, to }: { from: Date; to: Date }) {
  const hourly = await getHourlyDistribution(from, to);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Heures de pointe</CardTitle>
        <p className="text-sm text-muted-foreground">
          Affluence et CA encaissé par heure de la journée, cumulés sur la
          période. Hors régularisations (sans heure).
        </p>
      </CardHeader>
      <CardContent>
        <PeakHoursChart data={hourly} />
      </CardContent>
    </Card>
  );
}
