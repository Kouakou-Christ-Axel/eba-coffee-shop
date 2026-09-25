import { getPreparationQueue } from './actions';
import { getMenu } from '@/lib/menu';
import { getContactSettings } from '@/lib/contact-settings-db';
import { PreparationView } from './preparation-view';

export const dynamic = 'force-dynamic';

export default async function PreparationPage() {
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
