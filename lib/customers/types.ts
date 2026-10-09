export type CustomerStats = {
  ordersCount: number;
  totalSpent: number;
  lastOrderAt: Date | null;
};

export type CustomerListSummary = {
  totalClients: number;
  /** Fiches créées sur les 7 / 30 derniers jours (Customer.createdAt). */
  newLast7Days: number;
  newLast30Days: number;
  /** CA cumulé (commandes non annulées rattachées à un client) et panier moyen associé. */
  revenueTotal: number;
  ordersCount: number;
  averageBasket: number;
  /** Segmentation par ancienneté de la dernière commande non annulée. */
  active30Days: number;
  active60Days: number;
  active90Days: number;
  inactiveOver90Days: number;
  /** Clients n'ayant jamais commandé (fiche créée sans commande liée). */
  neverOrdered: number;
};

export type CustomerSortKey =
  | 'name'
  | 'ordersCount'
  | 'totalSpent'
  | 'lastOrderAt';

export type SortDir = 'asc' | 'desc';

export type RankedCustomer = { id: string; name: string | null; phone: string };

export type OrderItemLike = { productName?: unknown; quantity?: unknown };

export type CustomerDetailStats = CustomerStats & {
  /** Date de la première commande non annulée (ancienneté d'achat). */
  firstOrderAt: Date | null;
  cancelledCount: number;
  /** Part des commandes annulées sur l'ensemble des commandes du client (0..1). */
  cancellationRate: number;
  /** Article le plus commandé en quantité cumulée (commandes non annulées). */
  favoriteProduct: { name: string; quantity: number } | null;
};
