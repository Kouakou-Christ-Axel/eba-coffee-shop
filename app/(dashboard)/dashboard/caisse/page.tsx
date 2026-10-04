import { requireCashier } from '@/lib/auth-helpers';
import { expirePendingOrders } from '@/lib/jeko/expiry';
import { fetchCashierQueue } from '@/lib/cashier-queue';
import { getMenu } from '@/lib/menu';
import { getContactSettings } from '@/lib/contact-settings-db';
import { CaisseView } from './caisse-view';

export const dynamic = 'force-dynamic';

export default async function CaissePage() {
  const session = await requireCashier();
  // Expiration opportuniste des commandes en attente de paiement Jèko (pas de
  // cron : même principe que le rappel d'inventaire — idempotent, fire-and-forget).
  void expirePendingOrders().catch(() => {});
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
