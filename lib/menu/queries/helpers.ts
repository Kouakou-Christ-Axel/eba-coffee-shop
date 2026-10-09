/** Jours communs produit/catégorie : null = sans restriction, sinon un tableau (même vide). */
export function intersectAvailableDays(
  a: number[] | null,
  b: number[] | null
): number[] | null {
  if (a == null && b == null) return null;
  if (a == null) return b;
  if (b == null) return a;
  return a.filter((d) => b.includes(d));
}

/** Délai effectif = le plus restrictif (max) du produit et de sa catégorie ; null = aucun. */
export function effectiveAdvanceOrderDays(
  productDays: number | null,
  categoryDays: number | null
): number | null {
  if (productDays == null && categoryDays == null) return null;
  return Math.max(productDays ?? 0, categoryDays ?? 0);
}

export const globalSupplementGroupsInclude = {
  where: { isGlobal: true as const },
  orderBy: { sortOrder: 'asc' as const },
  include: { options: { orderBy: { sortOrder: 'asc' as const } } },
};
