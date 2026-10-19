// lib/refunds/labels.ts
//
// Libellés français et teintes des remboursements (écrans, mêmes mots partout).

import type { RefundStatus } from '@/generated/prisma/client';

export const REFUND_STATUS_LABELS: Record<RefundStatus, string> = {
  REQUESTED: 'À valider',
  APPROVED: 'Validé',
  PROCESSING: 'Transfert en cours',
  UNCERTAIN: 'À vérifier',
  FAILED: 'Échec',
  PAID: 'Remboursé',
  REJECTED: 'Refusé',
  CANCELLED: 'Annulé',
};

export type RefundTone = 'neutral' | 'warning' | 'danger' | 'success';

export const REFUND_STATUS_TONES: Record<RefundStatus, RefundTone> = {
  REQUESTED: 'warning',
  APPROVED: 'neutral',
  PROCESSING: 'neutral',
  UNCERTAIN: 'danger',
  FAILED: 'danger',
  PAID: 'success',
  REJECTED: 'neutral',
  CANCELLED: 'neutral',
};

export const REFUND_DELIVERY_LABELS = {
  JEKO_TRANSFER: 'Transfert Jèko',
  MANUAL: 'Remise à la main',
} as const;

export const REFUND_SOURCE_LABELS = {
  STAFF: 'Demande du personnel',
  AUTO_LATE: 'Paiement tardif (automatique)',
} as const;

/** Ce qu'on peut faire d'un remboursement dans chaque statut, pour l'écran. */
export const REFUND_STATUS_HINTS: Record<RefundStatus, string> = {
  REQUESTED: 'En attente de la validation d’un administrateur.',
  APPROVED: 'Validé : à remettre au client.',
  PROCESSING: 'Le transfert est parti, on attend la réponse de Jèko.',
  UNCERTAIN:
    'On ignore si le transfert est parti. Vérifier dans le Dashboard Jèko avant de trancher.',
  FAILED: 'Le remboursement n’est pas parti.',
  PAID: 'L’argent est parti.',
  REJECTED: 'Refusé par un administrateur.',
  CANCELLED: 'Annulé avant que l’argent ne parte.',
};
