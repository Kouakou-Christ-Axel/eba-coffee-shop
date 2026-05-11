import { getPickupSettings } from '@/lib/pickup-settings-db';
import { ParametresView } from './parametres-view';

export const dynamic = 'force-dynamic';

export default async function ParametresPage() {
  const settings = await getPickupSettings();
  return <ParametresView initialSettings={settings} />;
}
