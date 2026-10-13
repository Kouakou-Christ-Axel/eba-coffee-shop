import type { CartItemSupplement } from '@/lib/cart-store';
import type { Product } from '@/config/menu';
import type { QuickAddSink } from '../use-quick-add';

export type SupplementModalProps = {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
  /** Pré-remplit depuis une ligne existante (mode « dupliquer avec des
   * suppléments différents » depuis le panier), plutôt que partir de zéro. */
  initialSupplements?: CartItemSupplement[];
  /** Jeton qui force la réinitialisation des sélections quand il change (ex.
   * cartId de la ligne dupliquée). Laisser indéfini en ajout normal. */
  editToken?: string;
  /** Destination de l'ajout à la place du panier (ex. remplacer une ligne
   * épuisée à sa position — `sold-out-resolver.tsx`). Appelée une fois avec
   * la quantité choisie. */
  onConfirm?: QuickAddSink;
  /** Retrait AUJOURD'HUI obligatoire : les options épuisées deviennent non
   * sélectionnables, et `ignoreSoldOut` est coupé pour les QUATRE helpers de
   * sélection (cf. CLAUDE.md, « SupplementRules.ignoreSoldOut »). */
  strictStock?: boolean;
  /** Quantité de départ (ex. celle de la ligne remplacée). Défaut : 1. */
  initialQuantity?: number;
};
