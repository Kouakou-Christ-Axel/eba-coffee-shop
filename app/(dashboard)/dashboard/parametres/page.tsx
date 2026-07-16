import { getPickupSettings } from '@/lib/pickup-settings-db';
import { getLoyaltySettings } from '@/lib/loyalty-settings-db';
import { getContactSettings } from '@/lib/contact-settings-db';
import { ParametresView } from './parametres-view';
import { LoyaltySettingsForm } from './loyalty-settings-form';
import { ContactSettingsForm } from './contact-settings-form';

export const dynamic = 'force-dynamic';

export default async function ParametresPage() {
  const [settings, loyalty, contact] = await Promise.all([
    getPickupSettings(),
    getLoyaltySettings(),
    getContactSettings(),
  ]);
  return (
    <div className="space-y-8">
      <ParametresView initialSettings={settings} />
      <LoyaltySettingsForm initial={loyalty} />
      <ContactSettingsForm initial={contact} />
    </div>
  );
}
