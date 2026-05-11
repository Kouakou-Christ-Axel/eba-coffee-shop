import { getPreparationQueue } from './actions';
import { PreparationView } from './preparation-view';

export const dynamic = 'force-dynamic';

export default async function PreparationPage() {
  const initialQueue = await getPreparationQueue();

  return <PreparationView initialQueue={initialQueue} />;
}
