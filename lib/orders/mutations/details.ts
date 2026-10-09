// lib/orders/mutations/details.ts
//
// Mutations de commandes — details (extrait de lib/order-mutations.ts, sans changement de comportement).

import prisma from '@/lib/prisma';
import { updateOrderDetailsSchema } from '@/lib/schemas/order';
import { OrderMutationError } from './errors';

// ─── Édition administrative des métadonnées ───────────────────────────────────

/**
 * Met à jour les métadonnées d'une commande (moyen de paiement, type de commande,
 * créneau de retrait, note). Réservé à l'ADMIN au niveau des appelants
 * (server action `requireAdmin`, garde-fou MCP). Mise à jour partielle : seuls
 * les champs fournis sont écrits.
 *
 * `pickupTime` est une chaîne ISO 8601 (UTC) ou null ; comme Abidjan = UTC+0,
 * elle reflète directement l'heure locale affichée.
 *
 * Garde-fou de cohérence : on n'autorise pas à retirer le mode de paiement
 * (`paymentMode: null`) d'une commande déjà payée — sinon l'état deviendrait
 * « payée sans mode ».
 */
export async function updateOrderDetails(id: string, input: unknown) {
  const data = updateOrderDetailsSchema.parse(input);

  const order = await prisma.order.findUnique({
    where: { id },
    select: { isPaid: true },
  });
  if (!order) {
    throw new OrderMutationError('Commande introuvable', 404);
  }
  if (data.paymentMode === null && order.isPaid) {
    throw new OrderMutationError(
      'Impossible de retirer le mode de paiement d’une commande payée',
      400
    );
  }

  return prisma.order.update({
    where: { id },
    data: {
      ...(data.orderType !== undefined ? { orderType: data.orderType } : {}),
      ...(data.pickupTime !== undefined
        ? { pickupTime: data.pickupTime ? new Date(data.pickupTime) : null }
        : {}),
      ...(data.paymentMode !== undefined
        ? { paymentMode: data.paymentMode }
        : {}),
      ...(data.note !== undefined ? { note: data.note ?? null } : {}),
    },
  });
}
