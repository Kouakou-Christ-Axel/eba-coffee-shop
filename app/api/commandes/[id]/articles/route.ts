// app/api/commandes/[id]/articles/route.ts
//
// PATCH /api/commandes/:id/articles — `{ changes: [{ cartId, action:
// 'remove' } | { cartId, action: 'replace', with: { productId, quantity,
// supplements? } }] }`. Remplace ou retire les articles DEVENUS
// INDISPONIBLES d'une commande pas encore engagée ; les prix sont résolus
// côté serveur (lib/order-self-service.ts). Réponse : `{ order }`.

import { customerItemChangesSchema } from '@/lib/schemas/order';
import { replaceUnavailableItems } from '@/lib/order-self-service';
import { runSelfService } from '@/lib/order-self-service-http';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  return runSelfService(
    req,
    id,
    customerItemChangesSchema,
    ({ changes }) => replaceUnavailableItems(id, changes),
    'PATCH /api/commandes/:id/articles'
  );
}
