import type { ContactSettings } from '@/lib/contact-settings';

export type CaisseContactSettings = Pick<
  ContactSettings,
  | 'yangoLandmark'
  | 'mapsDirectionsUrl'
  | 'wavePaymentNumber'
  | 'orangeMoneyPaymentNumber'
>;
