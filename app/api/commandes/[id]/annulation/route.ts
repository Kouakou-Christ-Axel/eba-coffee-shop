// app/api/commandes/[id]/annulation/route.ts
//
// POST /api/commandes/:id/annulation — le client annule sa commande, tant
// qu'elle n'est ni payée ni en cuisine (lib/orders/self-service.ts). La
// fidélité gagnée par la commande est défaite (lib/order-self-service.ts).
// Réponse : `{ order }`, la vue publique à jour.

import { cancelOrderByCustomer } from '@/lib/order-self-service';
import { runSelfService } from '@/lib/order-self-service-http';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  return runSelfService(
    req,
    id,
    null,
    () => cancelOrderByCustomer(id),
    'POST /api/commandes/:id/annulation'
  );
}
