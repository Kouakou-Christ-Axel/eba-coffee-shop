import type { SupplementKind } from '@/config/menu-types';

/**
 * Marque posée sur une ligne de commande pour un goût. Seul `flavor` est écrit :
 * absent = supplément, ce qui garde intactes les commandes antérieures au champ
 * et n'alourdit pas le JSON des lignes ordinaires.
 */
export function kindStamp(group: { kind?: SupplementKind }): {
  kind?: 'flavor';
} {
  return group.kind === 'flavor' ? { kind: 'flavor' } : {};
}

export function isFlavor(line: { kind?: SupplementKind }): boolean {
  return line.kind === 'flavor';
}

/** Sépare les lignes d'une commande en goûts et suppléments, ordre conservé. */
export function splitSupplementsByKind<T extends { kind?: SupplementKind }>(
  lines: T[]
): { flavors: T[]; extras: T[] } {
  return {
    flavors: lines.filter(isFlavor),
    extras: lines.filter((l) => !isFlavor(l)),
  };
}
