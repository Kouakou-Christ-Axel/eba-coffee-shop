import { requireCashier } from '@/lib/auth-helpers';
import { getMenu } from '@/lib/menu';
import {
  getPendingDemand,
  attachPendingDemand,
} from '@/lib/orders/pending-demand';
import { NewOrderView } from './new-order-view';

export const dynamic = 'force-dynamic';

export default async function NewOrderPage() {
  const [, menu, pendingDemand] = await Promise.all([
    requireCashier(),
    getMenu(),
    getPendingDemand(),
  ]);

  return (
    <NewOrderView menu={attachPendingDemand(menu, pendingDemand.products)} />
  );
}
