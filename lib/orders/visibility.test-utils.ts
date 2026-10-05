// lib/orders/visibility.test-utils.ts
//
// Utilitaire RÉSERVÉ AUX TESTS. Les lectures de commandes enveloppent leur clause
// dans `withStaffVisible` (lib/orders/visibility.ts) ; un test qui veut vérifier la
// clause métier d'origine la récupère ici. L'utilitaire ÉCHOUE si l'enveloppe est
// absente : chaque test qui l'emploie prouve aussi que le filtre est appliqué.

import { STAFF_VISIBLE } from './visibility';

export function unwrapStaffVisible<T = Record<string, unknown>>(
  where: unknown
): T {
  const and = (where as { AND?: unknown[] } | null | undefined)?.AND;
  if (
    !Array.isArray(and) ||
    and.length !== 2 ||
    JSON.stringify(and[1]) !== JSON.stringify(STAFF_VISIBLE)
  ) {
    throw new Error(
      `Clause sans la visibilité staff (withStaffVisible attendu) : ${JSON.stringify(where)}`
    );
  }
  return and[0] as T;
}
