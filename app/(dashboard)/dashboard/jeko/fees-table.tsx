import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { JekoStats } from '@/lib/jeko/stats';

const fmt = new Intl.NumberFormat('fr-FR');
const f = (n: number) => `${fmt.format(n)} F`;
const monthLabel = (m: string) =>
  new Intl.DateTimeFormat('fr-FR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${m}-01T00:00:00Z`));
const rate = (part: number, whole: number) =>
  whole ? `${((part / whole) * 100).toFixed(2).replace('.', ',')} %` : '—';

/** Frais mois par mois sur la plage, avec un total. */
export function FeesTable({ stats }: { stats: JekoStats }) {
  const { months, totals } = stats;
  if (months.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Frais détaillés</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Mois</th>
              <th className="px-3 py-2 text-right font-medium">Encaissé</th>
              <th className="px-3 py-2 text-right font-medium">Frais Jèko</th>
              <th className="px-3 py-2 text-right font-medium">
                Frais clients
              </th>
              <th className="px-3 py-2 text-right font-medium">Coût net</th>
              <th className="px-3 py-2 text-right font-medium">
                Frais de retrait
              </th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {months.map((m) => (
              <tr key={m.month} className="border-b last:border-0">
                <td className="whitespace-nowrap py-2 pr-3 capitalize">
                  {monthLabel(m.month)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  {f(m.collected)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  {f(m.gatewayFees)}
                  <span className="block text-xs text-muted-foreground">
                    {rate(m.gatewayFees, m.collected)}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  {f(m.customerFees)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  {f(m.netCost)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  {f(m.withdrawalFees)}
                </td>
              </tr>
            ))}
          </tbody>
          {months.length > 1 && (
            <tfoot className="tabular-nums font-medium">
              <tr className="border-t">
                <td className="py-2 pr-3">Total</td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  {f(totals.collected)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  {f(totals.gatewayFees)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  {f(totals.customerFees)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  {f(totals.netCost)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  {f(totals.withdrawalFees)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </CardContent>
    </Card>
  );
}
