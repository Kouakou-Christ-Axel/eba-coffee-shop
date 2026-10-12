export type ProductRow = {
  id: string;
  name: string;
  price: number;
  coutMatiere: number;
  coutEmballage: number;
  imageUrl: string | null;
  available: boolean;
  featured: boolean;
  featuredBadge: string | null;
  stockQuantity: number | null;
  unavailableUntil: Date | null;
  scheduleName: string | null;
  weeklySpecialPeriods: { startDate: string; endDate: string }[];
  /** Quantité déjà demandée par des commandes NON payées (lecture seule). */
  pending?: number;
};

export const priceFmt = new Intl.NumberFormat('fr-FR');
export const SEARCH_DEBOUNCE_MS = 350;
export type Availability = 'all' | 'visible' | 'hidden';

export function isAvailability(v: string | null): v is Availability {
  return v === 'all' || v === 'visible' || v === 'hidden';
}
