import type { EncaisserAction } from '../../../_components/encaisser-button';
import type { AssociateCustomerAction } from '../../../_components/associate-customer';
import type { ContactSettings } from '@/lib/contact-settings';

export type ContactInfo = Pick<ContactSettings, 'yangoLandmark' | 'phone'>;

export type OrderDetailCallbacks = {
  onReady: (id: string) => void;
  onCancel: (id: string) => void;
  onRequestDriver: (id: string) => void;
  onRetrieve: (id: string) => void;
  /** Action d'encaissement cuisine — affiche le bouton Encaisser si fournie et la commande n'est pas payée. */
  payAction?: EncaisserAction;
  /** Action d'association client cuisine — affiche le bouton « Associer un client » si fournie. */
  customerAction?: AssociateCustomerAction;
};
