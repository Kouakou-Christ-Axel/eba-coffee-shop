export type ArticleStatRow = {
  articleId: string;
  name: string;
  baseUnit: string | null;
  purchaseCount: number;
  totalAmount: number;
  totalQtyBase: number | null;
  avgUnitPrice: number | null;
  lastPurchaseDate: string | null;
  avgIntervalDays: number | null;
  monthlyAvgCount: number;
  monthlyAvgQtyBase: number | null;
};

/** Métadonnées complètes d'un article actif (référentiel), pour les actions
 * d'administration (réglages, fusion) — indépendant des filtres de période. */
export type ArticleMeta = {
  id: string;
  name: string;
  baseUnit: string | null;
  trackInventory: boolean;
  inventoryItemId: string | null;
  location: string | null;
  wholesaleRefPrice: number | null;
  /** Nombre total de lignes de dépense rattachées (toutes périodes) — sert de
   * prévisualisation avant fusion (« N lignes seront rattachées à… »). */
  itemsCount: number;
};

/** Référence d'inventaire disponible pour le sélecteur de liaison stock. */
export type InventoryItemOption = {
  id: string;
  name: string;
  sku: string;
  unit: string;
};
