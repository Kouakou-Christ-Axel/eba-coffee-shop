import type { CartItem } from '@/lib/cart-store';
import type { CartAvailability } from '@/lib/cart-availability';
import type { MenuCategory } from '@/config/menu';
import type { OnlinePaymentState } from '@/lib/hooks/use-online-payment';

export type CheckoutFormProps = {
  items: CartItem[];
  /** Total BRUT du panier (le serveur déduit lui-même la récompense). */
  total: number;
  onBack: () => void;
  /** `paymentUrl` : page de paiement vers laquelle rediriger (null = aucune). */
  onSuccess: (
    orderId: string,
    paymentUrl: string | null,
    paymentError: boolean
  ) => void;
  /** Remonte la remise fidélité appliquée pour le récap de la page. */
  onLoyaltyDiscountChange?: (discount: number) => void;
  /** Remonte l'avoir appliqué (retenu sur le solde du client) pour le récap. */
  onCreditChange?: (credit: number) => void;
  /** Config du paiement en ligne (lue par la page, cf. `useOnlinePayment`). */
  onlinePayment: OnlinePaymentState;
  /** Menu frais chargé par la page (partagé avec le panneau « Résoudre »). */
  menu?: MenuCategory[] | null;
  /** Panier revérifié contre ce menu (`useCartAvailability`). */
  availability?: CartAvailability | null;
};
