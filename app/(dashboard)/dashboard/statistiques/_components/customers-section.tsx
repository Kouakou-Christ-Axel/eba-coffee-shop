import { Stamp, Ticket, UserCheck, UserPlus, Users } from 'lucide-react';
import { getCustomerRangeStats } from '@/lib/stats-customers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KpiCard } from '@/components/(dashboard)/kpi-card';

const priceFormatter = new Intl.NumberFormat('fr-FR');

export async function CustomersSection({ from, to }: { from: Date; to: Date }) {
  const customerStats = await getCustomerRangeStats(from, to);

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Clients & fidélité</h2>
        <p className="text-sm text-muted-foreground">
          Activité des clients identifiés (
          {Math.round(customerStats.identificationRate * 100)} % des commandes
          de la période) et mouvements de la carte de fidélité.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard
          label="Nouveaux clients"
          value={priceFormatter.format(customerStats.newCustomers)}
          Icon={UserPlus}
        />
        <KpiCard
          label="Clients actifs"
          value={priceFormatter.format(customerStats.activeCustomers)}
          Icon={Users}
        />
        <KpiCard
          label="Clients récurrents"
          value={priceFormatter.format(customerStats.returningCustomers)}
          Icon={UserCheck}
          hint="≥ 2 commandes sur la période"
        />
        <KpiCard
          label="Tampons gagnés"
          value={priceFormatter.format(customerStats.loyalty.stampsEarned)}
          Icon={Stamp}
          subtle
        />
        <KpiCard
          label="Récompenses utilisées"
          value={priceFormatter.format(customerStats.loyalty.rewardsUsed)}
          Icon={Ticket}
          subtle
          hint={`${priceFormatter.format(customerStats.loyalty.rewardsEarned)} débloquée${customerStats.loyalty.rewardsEarned > 1 ? 's' : ''}`}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top clients</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {customerStats.topCustomers.length > 0 ? (
            customerStats.topCustomers.map((c) => (
              <div
                key={c.customerId}
                className="flex items-center justify-between gap-3"
              >
                <span className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  {c.name ?? c.phone}
                </span>
                <span className="flex items-baseline gap-3 text-sm">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {priceFormatter.format(c.orders)} commande
                    {c.orders > 1 ? 's' : ''}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {priceFormatter.format(c.revenue)} F
                  </span>
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              Aucun client identifié sur la période.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
