import type { CartItem } from '@/lib/cart-store';
import type { LoyaltySettings } from '@/lib/loyalty-settings';
import type {
  OrderSource,
  OrderStatus,
  OrderType,
  PaymentMode,
  PaymentProofVerdict,
} from '@/generated/prisma/client';

export type CashierOrder = {
  id: string;
  reference: string;
  dailyNumber: number;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  pickupTime: Date | null;
  orderType: OrderType;
  items: CartItem[];
  note: string | null;
  total: number;
  /** Acompte minimum requis (`Order.depositRequired`) ; null = pas de règle d'acompte. */
  depositRequired: number | null;
  depositPaid: number | null;
  /** Récompense fidélité déjà déduite de `total` (null = aucune). */
  loyaltyDiscount: number | null;
  loyaltyRewardId: string | null;
  status: OrderStatus;
  isPaid: boolean;
  /** « Ardoise » : partie en cuisine sans encaissement ; toujours `isPaid: false`. */
  isOnAccount: boolean;
  /** Client lié « de confiance » : son impayé n'escalade pas en urgence. */
  customerTrusted: boolean;
  paymentMode: PaymentMode | null;
  /** Encaissement posé automatiquement par l'ancienne pré-analyse IA (verdict MATCH). */
  paymentAutoValidatedByAi: boolean;
  paymentProofUrl: string | null;
  /** Verdict de l'ancienne pré-analyse IA ; null si non analysée. */
  paymentProofVerdict: PaymentProofVerdict | null;
  paymentProofAnalysis: unknown;
  source: OrderSource;
  driverRequested: boolean;
  driverName: string | null;
  driverPhone: string | null;
  createdAt: Date;
  /** Amorces des minuteurs caisse ; null pour les commandes antérieures aux colonnes. */
  preparingStartedAt: Date | null;
  readyAt: Date | null;
  /** Instant de réservation du stock ; null tant que la commande n'est pas en cuisine. */
  stockReservedAt: Date | null;
  /** Article indisponible au stock actuel — calculé seulement si `stockReservedAt === null`. */
  stockShortage: boolean;
  unavailableItemNames: string[];
  /** Réglages fidélité, dupliqués par commande pour éviter le prop-drilling. */
  loyaltySettings: LoyaltySettings;
  /** Tampons du client lié ; null = commande anonyme. */
  loyaltyStampCount: number | null;
  /** Tampon crédité par cette commande — calculé seulement pour les commandes READY. */
  loyaltyPickupOutcome: {
    stampEarned: boolean;
    isFirstStampEver: boolean;
  } | null;
};
