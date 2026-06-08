import { getPickupSettings } from '@/lib/pickup-settings-db';
import { getLoyaltySettings } from '@/lib/loyalty-settings-db';
import { ParametresView } from './parametres-view';
import { LoyaltySettingsForm } from './loyalty-settings-form';

export const dynamic = 'force-dynamic';

export default async function ParametresPage() {
  const [settings, loyalty] = await Promise.all([
    getPickupSettings(),
    getLoyaltySettings(),
  ]);
  return (
    <div className="space-y-8">
      <ParametresView initialSettings={settings} />
      <LoyaltySettingsForm initial={loyalty} />
    </div>
  );
}
