import type { SupplementGroup } from '@/components/(dashboard)/supplements-editor';
import type { WeeklySpecialRow } from '../weekly-special-field';

export type ProductFormInitial = {
  id?: string;
  name: string;
  description: string;
  price: number;
  coutMatiere: number;
  coutEmballage: number;
  imageUrl: string | null;
  supplementGroups: SupplementGroup[];
  featured: boolean;
  featuredOrder: number;
  featuredBadge: string | null;
  stockQuantity: number | null;
  unavailableUntil: Date | null;
  scheduleId: string | null;
  // Délai de commande à l'avance en jours (`Product.advanceOrderDays`) ; null = aucune contrainte.
  advanceOrderDays: number | null;
  // Commande sur mesure : acompte minimum exigé au checkout (`Product.requiresDeposit`).
  requiresDeposit: boolean;
  weeklySpecials: WeeklySpecialRow[];
};

export const EMPTY: ProductFormInitial = {
  name: '',
  description: '',
  price: 0,
  coutMatiere: 0,
  coutEmballage: 0,
  imageUrl: null,
  supplementGroups: [],
  featured: false,
  featuredOrder: 0,
  featuredBadge: null,
  stockQuantity: null,
  unavailableUntil: null,
  scheduleId: null,
  advanceOrderDays: null,
  requiresDeposit: false,
  weeklySpecials: [],
};

// Vide en création : un « 0 » a l'air rempli et le produit partait à 0 FCFA sans que personne ne le voie.
export function initialAmount(value: number | undefined): string {
  return value === undefined ? '' : String(value);
}

export function initialSnapshot(initial: ProductFormInitial | undefined) {
  return JSON.stringify({
    name: initial?.name ?? EMPTY.name,
    description: initial?.description ?? EMPTY.description,
    price: initial?.price ?? EMPTY.price,
    coutMatiere: initial?.coutMatiere ?? EMPTY.coutMatiere,
    coutEmballage: initial?.coutEmballage ?? EMPTY.coutEmballage,
    imageUrl: initial?.imageUrl ?? null,
    groups: initial?.supplementGroups ?? [],
    featured: initial?.featured ?? EMPTY.featured,
    featuredOrder: initial?.featuredOrder ?? EMPTY.featuredOrder,
    featuredBadge: initial?.featuredBadge ?? EMPTY.featuredBadge,
    stockQuantity: initial?.stockQuantity ?? EMPTY.stockQuantity,
    scheduleId: initial?.scheduleId ?? EMPTY.scheduleId,
    advanceOrderDays: initial?.advanceOrderDays ?? EMPTY.advanceOrderDays,
    requiresDeposit: initial?.requiresDeposit ?? EMPTY.requiresDeposit,
  });
}
