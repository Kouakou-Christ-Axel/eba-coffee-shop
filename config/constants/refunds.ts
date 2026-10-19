import type { UserRole } from '@/generated/prisma/client';

/** Remboursements (lib/refunds). Fichier pur : client et serveur. */

/**
 * Qui valide, refuse, renvoie un remboursement. Un seul endroit : élargir à MANAGER
 * plus tard se fait ici. Un admin peut être à la fois demandeur et approbateur.
 */
export const REFUND_APPROVER_ROLES: UserRole[] = ['ADMIN'];

/** Qui demande un remboursement, le corrige, ou remet l'argent en main propre. */
export const REFUND_REQUEST_ROLES: UserRole[] = [
  'ADMIN',
  'MANAGER',
  'ASSISTANT_MANAGER',
  'CASHIER',
];

/** Qui consulte les remboursements (liste, détail, statistiques). Lecture seule hors REFUND_REQUEST_ROLES. */
export const REFUND_VIEW_ROLES: UserRole[] = [
  'ADMIN',
  'MANAGER',
  'ASSISTANT_MANAGER',
  'CASHIER',
  'COMPTABLE',
  'ANALYSTE',
];

export const REFUND_NOTE_MAX = 500;

export const REFUND_AMOUNT_MAX = 100_000_000;

/** Lignes (produits / suppléments) rattachables à un même remboursement. */
export const REFUND_LINES_MAX = 100;

/**
 * Un transfert resté `PROCESSING` sans identifiant Jèko au-delà de ce délai a
 * probablement perdu sa réponse (plantage, coupure) : on ne sait plus s'il est
 * parti, il passe « à vérifier ».
 */
export const REFUND_PROCESSING_STALE_MINUTES = 5;
