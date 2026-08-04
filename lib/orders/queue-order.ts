// lib/orders/queue-order.ts
//
// Ordre d'affichage FIFO de la file cuisine, partagé entre les écrans dashboard
// qui montrent les mêmes commandes « en cuisine » : préparation (KDS, via
// `lib/preparation-queue.ts`) et caisse (onglet « En cours »). Pur, sans
// dépendance à un type de commande précis : ne lit que `preparingStartedAt`,
// `createdAt` et `dailyNumber`, donc s'applique à `PreparationOrder` comme à
// `CashierOrder`.
//
// Pourquoi un helper dédié : le FIFO cuisine se compte depuis l'ENTRÉE EN
// CUISINE, pas depuis la création. Une commande créée tôt mais encaissée tard
// entre en cuisine après une commande créée plus tard et encaissée aussitôt —
// trier par `createdAt` la placerait à tort en tête de la file cuisine.

/** Forme minimale d'une commande pour l'ordre de la file cuisine. */
export type KitchenSortable = {
  preparingStartedAt: Date | null;
  createdAt: Date;
  dailyNumber: number;
};

/**
 * Instant (ms epoch) d'entrée en cuisine servant de clé de tri.
 *
 * Repli sur `createdAt` quand `preparingStartedAt` est null (commandes
 * antérieures à l'ajout de la colonne) : c'est EXACTEMENT le repli qu'utilise
 * déjà l'affichage du chrono « en cuisine depuis X » (cf.
 * `app/(dashboard)/dashboard/preparation/_components/prep-order-card.tsx`).
 * Reléguer ces lignes en fin de file (« nulls last ») contredirait donc leur
 * propre minuteur visible.
 */
export function kitchenEntryTime(o: KitchenSortable): number {
  return (o.preparingStartedAt ?? o.createdAt).getTime();
}

/**
 * Comparateur FIFO cuisine : entrée en cuisine croissante, puis `createdAt`
 * croissant, puis `dailyNumber` croissant.
 *
 * Les deux départages ne sont pas cosmétiques : la liste est re-rendue à chaque
 * tick SSE et un tri non déterministe ferait « sauter » les cartes sous les
 * doigts de la cuisine.
 */
export function compareKitchenFifo(
  a: KitchenSortable,
  b: KitchenSortable
): number {
  const byEntry = kitchenEntryTime(a) - kitchenEntryTime(b);
  if (byEntry !== 0) return byEntry;
  const byCreation = a.createdAt.getTime() - b.createdAt.getTime();
  if (byCreation !== 0) return byCreation;
  return a.dailyNumber - b.dailyNumber;
}
