// Mutations de commandes — driver.

import prisma from '@/lib/prisma';
import { normalizeIvorianPhone } from '@/lib/phone';
import { OrderMutationError } from './errors';

// ─── Livreur du client (page publique de suivi) ───────────────────────────────

/**
 * Renseigne, modifie ou efface (les deux champs à null) le livreur envoyé par
 * le client. Appelée SANS rôle : la route publique s'appuie sur l'`id` cuid non
 * devinable (capability URL) — même modèle de confiance que la consultation de
 * la commande. Refusée une fois la commande récupérée ou annulée.
 */
export async function setOrderDriver(
  id: string,
  input: { driverName: string | null; driverPhone: string | null }
): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!order) {
    throw new OrderMutationError('Commande introuvable', 404);
  }
  if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
    throw new OrderMutationError(
      'Commande terminée ou annulée : livreur non modifiable',
      409
    );
  }

  const driverPhone = input.driverPhone
    ? (normalizeIvorianPhone(input.driverPhone) ?? input.driverPhone)
    : null;

  const result = await prisma.order.updateMany({
    where: { id, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
    data: { driverName: input.driverName, driverPhone },
  });
  if (result.count === 0) {
    throw new OrderMutationError(
      'État déjà modifié par un autre caissier',
      409
    );
  }
}
