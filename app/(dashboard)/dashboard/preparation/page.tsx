import { getPreparationQueue } from './actions';
import { getMenu } from '@/lib/menu';
import { PreparationView } from './preparation-view';

export const dynamic = 'force-dynamic';

export default async function PreparationPage() {
  const [initialQueue, menu] = await Promise.all([
    getPreparationQueue(),
    getMenu(),
  ]);

  return <PreparationView initialQueue={initialQueue} menu={menu} />;
}
