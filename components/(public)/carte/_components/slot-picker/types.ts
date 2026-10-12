import type { PickupInfoState } from '@/lib/hooks/use-pickup-info';
import type { PickupTiming } from '@/lib/hooks/use-checkout-form';
import type { CartItem } from '@/lib/cart-store';

export type SlotPickerProps = {
  timing: PickupTiming;
  onTimingChange: (timing: PickupTiming) => void;
  value: string | null;
  onChange: (iso: string) => void;
  error?: string;
  info: PickupInfoState;
  /** Panier courant : sert à retirer du sélecteur les jours où un article
   * (planning récurrent `availableDays` et/ou fenêtre « spécialité de la
   * semaine » `weeklySpecialPeriods`, snapshotés sur `CartItem` à l'ajout —
   * voir lib/cart-store.ts) ne serait pas disponible. Confort uniquement :
   * la vérité reste revérifiée côté serveur par produit (lib/orders.ts). */
  items: CartItem[];
  /** Délai de commande à l'avance requis par le panier (jours), voir
   * `Product.advanceOrderDays` (lib/menu.ts). 0/absent = pas de contrainte. */
  minAdvanceOrderDays?: number;
  /**
   * La contrainte de jour vient d'un article ÉPUISÉ AUJOURD'HUI, pas d'une
   * règle « commande à l'avance » du produit. Change uniquement le message :
   * parler de commande à l'avance mentirait au client.
   */
  soldOutRestricted?: boolean;
  /**
   * La SEULE contrainte de jour vient d'articles épuisés aujourd'hui (pas
   * d'un `advanceOrderDays` générique > 1) : fige le jour sur demain, aucun
   * chip de jour à afficher — seulement le choix de l'heure. Un produit qui
   * cumule un vrai délai de commande (> 1 jour) en plus d'être épuisé retombe
   * correctement sur le régime générique (sélecteur de jour complet).
   */
  precommandePure?: boolean;
};
