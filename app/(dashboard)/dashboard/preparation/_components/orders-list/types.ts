import type { EncaisserAction } from '../../../_components/encaisser-button';

export type OrdersListVariant = 'scheduled' | 'ready' | 'topay';

export type RowCallbacks = {
  onExpand: (id: string) => void;
  onRetrieve: (id: string) => void;
  /** Lance une commande programmée en cuisine (variante `scheduled`). */
  onStartPreparation?: (id: string) => void;
  /** Annule la commande. Rendu comme petit bouton sur `ready`/`topay`. */
  onCancel?: (id: string) => void;
  /** Action d'encaissement cuisine, utilisée par la variante `topay`. */
  action?: EncaisserAction;
};
