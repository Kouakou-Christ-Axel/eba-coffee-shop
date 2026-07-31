import { requireCashier } from '@/lib/auth-helpers';
import { fetchCashierQueue } from '@/lib/cashier-queue';
import { getMenu } from '@/lib/menu';
import { getContactSettings } from '@/lib/contact-settings-db';
import { CaisseView } from './caisse-view';

export const dynamic = 'force-dynamic';

export default async function CaissePage() {
  const session = await requireCashier();
  const [initialQueue, menu, contactSettings] = await Promise.all([
    fetchCashierQueue(),
    getMenu(),
    getContactSettings(),
  ]);

  return (
    <CaisseView
      initialQueue={initialQueue}
      menu={menu}
      contactSettings={contactSettings}
      cashierName={session.user.name ?? session.user.email}
    />
  );
}
