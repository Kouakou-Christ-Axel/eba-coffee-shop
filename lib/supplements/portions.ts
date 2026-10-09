import type { SupplementGroup } from '@/config/menu';
import { type Selections, effectiveMin, effectiveMax } from './rules';

/** Vrai si le groupe décrit une boîte de N parts à répartir exactement. */
export function isFixedPortionGroup(group: SupplementGroup): boolean {
  if (group.type !== 'quantity') return false;
  const max = effectiveMax(group);
  return Number.isFinite(max) && max > 0 && effectiveMin(group) === max;
}

/** Nombre de parts de la boîte. */
export function portionCount(group: SupplementGroup): number {
  return effectiveMax(group);
}

export function portionSlots(
  group: SupplementGroup,
  selections: Selections
): (string | null)[] {
  const counts = (selections[group.name] as Record<string, number>) ?? {};
  const filled = group.options.flatMap((opt) =>
    Array.from({ length: Math.max(0, counts[opt.name] ?? 0) }, () => opt.name)
  );
  const size = portionCount(group);
  return [
    ...filled.slice(0, size),
    ...Array.from({ length: Math.max(0, size - filled.length) }, () => null),
  ];
}

/** Nom du groupe débarrassé d'un suffixe « (N parts) » saisi à la main. */
export function stripPortionSuffix(name: string): string {
  return name.replace(/\s*\(\s*\d+\s*parts?\s*\)\s*$/i, '').trim() || name;
}
