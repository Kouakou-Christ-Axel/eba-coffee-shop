import type { Product } from '@/config/menu';

export type CatalogCallbacks = {
  onProductTap: (product: Product) => void;
  /** Ouvre le sélecteur de suppléments à la demande (bouton « Options »). */
  onOpenOptions?: (product: Product) => void;
  /** Réappro rapide du stock du PRODUIT (pas d'un goût) depuis sa tuile. */
  onRestockProduct?: (productId: string, stock: number | null) => void;
};
