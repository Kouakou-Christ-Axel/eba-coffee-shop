import { requireCashier } from '@/lib/auth-helpers';
import { fetchCashierQueue } from '@/lib/cashier-queue';
import { CaisseView } from './caisse-view';

export const dynamic = 'force-dynamic';

export default async function CaissePage() {
  const session = await requireCashier();
  const initialQueue = await fetchCashierQueue();

  return (
    <CaisseView
      initialQueue={initialQueue}
      cashierName={session.user.name ?? session.user.email}
    />
  );
}
