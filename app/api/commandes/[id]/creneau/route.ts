// app/api/commandes/[id]/creneau/route.ts
//
// PATCH /api/commandes/:id/creneau — `{ pickupTime: ISO | null }` (null =
// « dès que possible »). Le créneau doit être proposé par le sélecteur
// (horaires, délai, capacité) et respecter les règles de la commande
// (lib/order-self-service.ts). Réponse : `{ order }`.

import { customerRescheduleSchema } from '@/lib/schemas/order';
import { rescheduleOrderByCustomer } from '@/lib/order-self-service';
import { runSelfService } from '@/lib/order-self-service-http';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  return runSelfService(
    req,
    id,
    customerRescheduleSchema,
    ({ pickupTime }) => rescheduleOrderByCustomer(id, pickupTime),
    'PATCH /api/commandes/:id/creneau'
  );
}
