import { getPreparationQueue } from './actions';
import { expirePendingOrders } from '@/lib/jeko/expiry';
import { getMenu } from '@/lib/menu';
import { getContactSettings } from '@/lib/contact-settings-db';
import { PreparationView } from './preparation-view';

export const dynamic = 'force-dynamic';

export default async function PreparationPage() {
  // Expiration opportuniste des commandes en attente de paiement Jèko (pas de
  // cron : même principe que le rappel d'inventaire — idempotent, fire-and-forget).
  void expirePendingOrders().catch(() => {});
  const [initialQueue, menu, contactSettings] = await Promise.all([
    getPreparationQueue(),
    getMenu(),
    getContactSettings(),
  ]);

  return (
    <PreparationView
      initialQueue={initialQueue}
      menu={menu}
      contactSettings={contactSettings}
    />
  );
}
