import { requireKitchen } from '@/lib/auth-helpers';
import { getMenu } from '@/lib/menu';
import { NewOrderView } from '../../caisse/new/new-order-view';

export const dynamic = 'force-dynamic';

// La cuisine crée une commande directement dans son propre écran : elle
// part en préparation immédiatement (sur place / à emporter, cf.
// `createCashierOrder`), sans passer par la caisse. Même vue que
// `/dashboard/caisse/new` — juste une porte d'entrée et un retour
// différents.
export default async function PreparationNewOrderPage() {
  const [, menu] = await Promise.all([requireKitchen(), getMenu()]);

  return (
    <NewOrderView
      menu={menu}
      backHref="/dashboard/preparation"
      initialOrderType="DINE_IN"
    />
  );
}
