// Section « Statistiques » de la fiche produit. Server component : lit
// l'agrégat de `lib/product-stats.ts` et le rend. Streamé sous <Suspense> par
// la page, pour ne jamais retarder l'affichage du formulaire.

import {
  Banknote,
  CalendarCheck,
  ClipboardList,
  PieChart,
  ShoppingBasket,
  TrendingUp,
} from 'lucide-react';
import { getProductStats } from '@/lib/product-stats';
import { KpiCard } from '@/components/(dashboard)/kpi-card';
import { ProductSalesChart } from '@/components/(dashboard)/charts/product-sales-chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const priceFmt = new Intl.NumberFormat('fr-FR');
const decimalFmt = new Intl.NumberFormat('fr-FR', {
  maximumFractionDigits: 1,
});

/** « 3 juin » — court, la carte KPI rend la valeur en très gros. */
function dayShort(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(d);
}

/** « mercredi 3 juin 2026 » — relégué en indice sous la valeur. */
function dayLong(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}

export async function ProductStatsSection({
  productId,
  from,
  to,
}: {
  productId: string;
  from: Date;
  to: Date;
}) {
  const stats = await getProductStats(productId, from, to);

  const marginPct =
    stats.revenue > 0 ? Math.round((stats.margin / stats.revenue) * 100) : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <KpiCard
          label="Unités vendues"
          value={priceFmt.format(stats.quantity)}
          Icon={ShoppingBasket}
          hint={
            stats.daysWithSales > 0
              ? `sur ${priceFmt.format(stats.daysWithSales)} jour${stats.daysWithSales > 1 ? 's' : ''} de vente / ${priceFmt.format(stats.rangeDays)}`
              : undefined
          }
        />
        <KpiCard
          label="Chiffre d'affaires"
          value={`${priceFmt.format(stats.revenue)} F`}
          Icon={Banknote}
          hint={
            stats.quantity > 0
              ? `${priceFmt.format(Math.round(stats.revenue / stats.quantity))} F par unité`
              : undefined
          }
        />
        <KpiCard
          label="Marge dégagée"
          value={`${priceFmt.format(stats.margin)} F`}
          Icon={TrendingUp}
          valueClassName={
            stats.margin < 0 ? 'text-destructive' : 'text-green-600'
          }
          hint={
            stats.quantityWithoutCost > 0
              ? `surestimée : ${priceFmt.format(stats.quantityWithoutCost)} unité${stats.quantityWithoutCost > 1 ? 's' : ''} vendue${stats.quantityWithoutCost > 1 ? 's' : ''} sans coût enregistré`
              : marginPct !== null
                ? `${marginPct} % du CA · coûts ${priceFmt.format(stats.cost)} F`
                : undefined
          }
        />
        <KpiCard
          label="Commandes"
          value={priceFmt.format(stats.orders)}
          Icon={ClipboardList}
          hint={
            stats.orders > 0
              ? `${decimalFmt.format(stats.avgQuantityPerOrder)} unité${stats.avgQuantityPerOrder > 1 ? 's' : ''} par commande`
              : undefined
          }
        />
        <KpiCard
          label="Part du CA produits"
          value={`${Math.round(stats.revenueShare * 100)} %`}
          Icon={PieChart}
          hint={
            stats.quantityRank !== null
              ? `${stats.quantityRank}ᵉ produit sur ${priceFmt.format(stats.soldProductCount)} vendus`
              : 'aucune vente sur la période'
          }
        />
        <KpiCard
          label="Dernière vente"
          value={stats.lastSoldOn ? dayShort(stats.lastSoldOn) : '—'}
          Icon={CalendarCheck}
          subtle
          hint={
            stats.lastSoldOn
              ? dayLong(stats.lastSoldOn)
              : 'aucune sur la période sélectionnée'
          }
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ventes par jour</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductSalesChart data={stats.series} />
        </CardContent>
      </Card>

      {stats.topSupplements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Suppléments les plus choisis
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {stats.topSupplements.map((s) => (
              <Badge
                key={`${s.groupName}-${s.optionName}`}
                variant="outline"
                className="gap-1.5 py-1"
              >
                <span>{s.optionName}</span>
                <span className="text-muted-foreground">{s.groupName}</span>
                <span className="font-semibold tabular-nums">
                  ×{priceFmt.format(s.quantity)}
                </span>
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Ventes hors commandes annulées, encaissées ou non — c&apos;est ce qui
        est sorti de la cuisine, pas la trésorerie. Les coûts viennent du
        montant figé sur chaque ligne de commande : modifier la fiche produit
        aujourd&apos;hui ne réécrit pas l&apos;historique.
      </p>
    </div>
  );
}
