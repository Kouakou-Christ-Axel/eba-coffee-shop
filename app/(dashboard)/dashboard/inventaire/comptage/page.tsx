import { requireKitchen } from '@/lib/auth-helpers';
import { listInventoryItems } from '@/lib/inventory';
import { BackButton } from '@/components/(dashboard)/back-button';

import { CountView } from './count-view';

// Page d'administration : données live, jamais prérendue.
export const dynamic = 'force-dynamic';

export default async function ComptagePage() {
  // `requireKitchen` et non `requireRoleOrAnalyst` : un ANALYSTE est en lecture
  // seule, lui servir un écran de saisie dont `recordInventoryCountAction`
  // refusera la validation à la fin serait une perte de temps organisée.
  await requireKitchen();
  const items = await listInventoryItems();

  return (
    <div className="space-y-4">
      <div>
        <BackButton
          fallbackHref="/dashboard/inventaire"
          label="Inventaire"
          className="-ml-3 mb-2"
        />
        <h1 className="text-xl font-bold">Comptage du stock</h1>
      </div>

      <CountView items={items} />
    </div>
  );
}
