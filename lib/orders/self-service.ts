// lib/orders/self-service.ts
//
// Quand un client peut-il agir SEUL sur sa commande (annuler, remplacer un
// article indisponible, changer de créneau) depuis la page de suivi ?
//
// Tant que rien n'est engagé de notre côté ni du sien :
//   - commande EN LIGNE (`source: ONLINE`) — une commande caisse est gérée au
//     comptoir ;
//   - toujours `NEW` : pas encore en cuisine ;
//   - stock non réservé (`stockReservedAt` nul) : rien n'a été décompté ;
//   - aucun argent en jeu : ni payée, ni preuve Wave envoyée (le montant est
//     alors figé — une modification appellerait un remboursement), ni acompte,
//     ni ardoise.
// Au-delà, c'est le comptoir qui tranche (lien WhatsApp de la page de suivi).
//
// Pur : partagé par le serveur (garde des mutations) et la vue publique
// (`getPublicOrder` expose les droits pour que l'interface n'affiche que les
// actions réellement possibles).

import type { Prisma } from '@/generated/prisma/client';

export type SelfServiceOrderState = {
  source: string;
  status: string;
  isPaid: boolean;
  stockReservedAt: Date | null;
  paymentProofUrl: string | null;
  depositPaid: number | null;
  isOnAccount: boolean;
};

export function canCustomerSelfServe(o: SelfServiceOrderState): boolean {
  return (
    o.source === 'ONLINE' &&
    o.status === 'NEW' &&
    !o.isPaid &&
    o.stockReservedAt === null &&
    o.paymentProofUrl === null &&
    !(o.depositPaid ?? 0) &&
    !o.isOnAccount
  );
}

/**
 * Même règle, en filtre Prisma : à poser dans le `where` de chaque
 * `updateMany` du libre-service. Si la caisse a encaissé ou lancé la commande
 * entre la lecture et l'écriture, l'écriture ne touche aucune ligne (409) —
 * jamais de modification client sur une commande déjà engagée.
 */
export const SELF_SERVICE_GUARD = {
  source: 'ONLINE',
  status: 'NEW',
  isPaid: false,
  stockReservedAt: null,
  paymentProofUrl: null,
  isOnAccount: false,
  OR: [{ depositPaid: null }, { depositPaid: 0 }],
} satisfies Prisma.OrderWhereInput;

/** Message quand le libre-service n'est plus possible. */
export const SELF_SERVICE_CLOSED_MESSAGE =
  'Ta commande est déjà prise en charge : contacte le comptoir pour la modifier.';
