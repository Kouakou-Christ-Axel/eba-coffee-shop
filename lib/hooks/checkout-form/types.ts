import type { CartItem } from '@/lib/cart-store';
import type { CheckoutErrorCode, SoldOutLine } from '@/lib/schemas/order';
import type { JekoPaymentMethod } from '@/lib/jeko/payment-methods';

/** Qui récupère : le client lui-même (TAKEAWAY) ou son livreur (DELIVERY). */
export type PickupMode = 'pickup' | 'driver';

/** Quand : dès que possible (pas de créneau) ou à un créneau planifié. */
export type PickupTiming = 'asap' | 'scheduled';

export type CheckoutFormValues = {
  customerName: string;
  customerPhone: string;
  // 1ʳᵉ question du modal : mode de récupération (cf. processus terrain).
  pickupMode: PickupMode;
  // « Dès que possible » (défaut, préparation immédiate comme un walk-in) ou
  // créneau planifié — `pickupTime` n'est requis que dans ce second cas.
  timing: PickupTiming;
  pickupTime: string | null;
  note: string;
  // Moyen choisi pour payer en ligne (Jèko). `null` tant que rien n'est choisi,
  // et sans objet quand le paiement en ligne est inactif (flux historique).
  paymentMethod: JekoPaymentMethod | null;
};

export type CheckoutFormErrors = Partial<
  Record<keyof CheckoutFormValues | 'submit', string>
>;

export type CheckoutSubmitOutcome =
  | {
      ok: true;
      orderId: string;
      reference: string;
      paymentUrl: string | null;
      /** La commande existe mais Jèko n'a pas pu démarrer le paiement : le client ira sur la page de suivi, où « Réessayer » le relance. */
      paymentError: boolean;
    }
  | {
      ok: false;
      error: string;
      /** Code serveur (`checkoutErrorCodeSchema`) — absent pour une erreur réseau ou une réponse illisible. */
      code?: CheckoutErrorCode;
      /** Champ du formulaire auquel rattacher `error` plutôt qu'au bas du formulaire. */
      field?: keyof CheckoutFormErrors;
      /** Lignes épuisées (`SOLD_OUT_TODAY`) : ouvrent le panneau « Résoudre » au lieu d'un simple message. */
      soldOutLines?: SoldOutLine[];
    };

/** Récompense fidélité appliquée à la soumission. */
export type CheckoutLoyaltyReward = {
  id: string;
  capAmount: number;
};

export type UseCheckoutFormResult = {
  values: CheckoutFormValues;
  errors: CheckoutFormErrors;
  isSubmitting: boolean;
  setField: <K extends keyof CheckoutFormValues>(
    key: K,
    value: CheckoutFormValues[K]
  ) => void;
  submit: (
    loyaltyReward?: CheckoutLoyaltyReward | null
  ) => Promise<CheckoutSubmitOutcome>;
  /** Lignes refusées par la dernière soumission (rupture du jour) — vide sinon. */
  soldOutLines: SoldOutLine[];
  /** Ouvre le panneau « Résoudre » sans aller-retour serveur, avec des lignes détectées côté client (`checkCartAgainstMenu`). */
  showSoldOutLines: (lines: SoldOutLine[]) => void;
  clearSoldOutLines: () => void;
};

export type UseCheckoutFormOptions = {
  items: CartItem[];
  /** Total BRUT du panier ; le serveur déduit lui-même la récompense. */
  total: number;
  paymentRequired?: boolean;
};
