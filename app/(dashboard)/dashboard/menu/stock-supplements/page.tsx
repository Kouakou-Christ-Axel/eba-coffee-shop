import { getAllOptionStock } from '@/lib/menu';
import { getPendingOptionDemand } from '@/lib/orders/pending-demand';
import { OptionsStockTable } from './options-stock-table';

export default async function StockSupplementsPage() {
  const [rows, pendingByOption] = await Promise.all([
    getAllOptionStock(),
    getPendingOptionDemand(),
  ]);

  const withPending = rows.map((r) => ({
    ...r,
    pending: pendingByOption.get(r.id) ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Stock par goût / option</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Toutes les options à stock suivi (« goûts »), tous produits confondus
          — y compris les extras globaux. La colonne « En attente » indique la
          quantité déjà demandée par des commandes NON payées ; le stock
          lui-même n’est décrémenté qu’au paiement (comportement inchangé).
        </p>
      </div>

      <OptionsStockTable rows={withPending} />
    </div>
  );
}
