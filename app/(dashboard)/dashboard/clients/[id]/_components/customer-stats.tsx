import { dateFmt, priceFmt } from './helpers';
import { Mini } from './mini';
import type { CustomerData } from './types';

export function CustomerStats({
  customer,
  stats,
  debtOwed,
}: {
  customer: CustomerData['customer'];
  stats: CustomerData['stats'];
  debtOwed: number;
}) {
  const averageBasket =
    stats.ordersCount > 0
      ? Math.round(stats.totalSpent / stats.ordersCount)
      : 0;
  // Intervalle moyen entre deux commandes non annulées, sur toute la durée
  // connue du client (firstOrderAt/lastOrderAt), pas seulement les 50
  // dernières lignes affichées ci-dessous.
  const purchaseFrequencyDays =
    stats.ordersCount > 1 && stats.firstOrderAt && stats.lastOrderAt
      ? Math.round(
          (stats.lastOrderAt.getTime() - stats.firstOrderAt.getTime()) /
            (stats.ordersCount - 1) /
            86_400_000
        )
      : null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Mini label="Commandes" value={String(stats.ordersCount)} />
      <Mini
        label="Total acheté"
        value={`${priceFmt.format(stats.totalSpent)} F`}
      />
      <Mini
        label="Panier moyen"
        value={`${priceFmt.format(averageBasket)} F`}
      />
      <Mini
        label="Dernière commande"
        value={stats.lastOrderAt ? dateFmt.format(stats.lastOrderAt) : '—'}
      />
      <Mini label="Client depuis" value={dateFmt.format(customer.createdAt)} />
      <Mini
        label="Fréquence d'achat"
        value={
          purchaseFrequencyDays !== null
            ? `~ tous les ${purchaseFrequencyDays} jour${purchaseFrequencyDays > 1 ? 's' : ''}`
            : '—'
        }
      />
      <Mini
        label="Taux d'annulation"
        value={
          stats.cancelledCount > 0
            ? `${Math.round(stats.cancellationRate * 100)} % (${stats.cancelledCount})`
            : '0 %'
        }
      />
      <Mini
        label="Produit favori"
        value={stats.favoriteProduct ? stats.favoriteProduct.name : '—'}
      />
      <Mini
        label="Ardoise en cours"
        value={debtOwed > 0 ? `${priceFmt.format(debtOwed)} F` : '0 F'}
        alert={debtOwed > 0}
      />
    </div>
  );
}
