import { requireCashier } from '@/lib/auth-helpers';
import { fetchCashierQueue } from '@/lib/cashier-queue';
import { getMenu } from '@/lib/menu';
import { CaisseView } from './caisse-view';

export const dynamic = 'force-dynamic';

export default async function CaissePage() {
  const session = await requireCashier();
  const [initialQueue, menu] = await Promise.all([
    fetchCashierQueue(),
    getMenu(),
  ]);

  return (
    <CaisseView
      initialQueue={initialQueue}
      menu={menu}
      cashierName={session.user.name ?? session.user.email}
    />
  );
}
