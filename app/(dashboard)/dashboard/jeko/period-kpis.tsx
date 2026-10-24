import {
  ArrowDownToLine,
  Landmark,
  Percent,
  Receipt,
  ShoppingBasket,
  Undo2,
  Wallet,
} from 'lucide-react';
import { KpiCard } from '@/components/(dashboard)/kpi-card';
import type { JekoStats } from '@/lib/jeko/stats';

const fmt = new Intl.NumberFormat('fr-FR');
const f = (n: number) => `${fmt.format(n)} F`;

/** Chiffres de la plage choisie. */
export function PeriodKpis({ totals }: { totals: JekoStats['totals'] }) {
  const pct = (n: number) =>
    totals.collected
      ? `${((n / totals.collected) * 100).toFixed(1).replace('.', ',')} % de l’encaissé`
      : undefined;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <KpiCard label="Encaissé" value={f(totals.collected)} Icon={Wallet} />
      <KpiCard
        label="Paiements"
        value={fmt.format(totals.count)}
        Icon={Receipt}
      />
      <KpiCard
        label="Panier moyen"
        value={f(totals.averageBasket)}
        Icon={ShoppingBasket}
      />
      <KpiCard
        label="Frais Jèko"
        value={f(totals.gatewayFees)}
        hint={pct(totals.gatewayFees)}
        Icon={Percent}
      />
      <KpiCard
        label="Frais payés par les clients"
        value={f(totals.customerFees)}
        hint={pct(totals.customerFees)}
        Icon={Percent}
      />
      <KpiCard
        label="Coût net pour EBA"
        value={f(totals.netCost)}
        hint="frais Jèko − frais clients"
        Icon={Landmark}
      />
      <KpiCard
        label="Remboursé"
        value={f(totals.refunded)}
        hint="transferts payés, frais compris"
        Icon={Undo2}
      />
      <KpiCard
        label="Retiré"
        value={f(totals.withdrawn)}
        hint={`${f(totals.withdrawalFees)} de frais de retrait`}
        Icon={ArrowDownToLine}
      />
    </div>
  );
}
