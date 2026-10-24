// Règles de calcul des stats client, en SQL — définies UNE fois, utilisées par la
// requête de stats de la page (`stats.ts`) et par le tri sur une stat
// (`filter.ts`). Alias attendus : `o` (order), `r` (refund), `ro` (order du refund).

import { Prisma } from '@/generated/prisma/client';

/**
 * Commande comptée dans les stats client : non annulée et visible du staff (une
 * commande en ligne jamais payée n'existe pas pour le CRM, cf. `STAFF_VISIBLE`).
 */
export const COUNTED_ORDER = Prisma.sql`o.status <> 'CANCELLED' AND (o."paymentExpiresAt" IS NULL OR o."isPaid")`;

/**
 * Remboursement déduit du total acheté : payé, hors conversion d'avoir (l'avoir a
 * déjà retiré le CA), sur une commande non annulée (déjà exclue du total).
 */
export const REFUND_DEDUCTED = Prisma.sql`r.status = 'PAID' AND r."creditSourceId" IS NULL AND ro.status <> 'CANCELLED'`;
