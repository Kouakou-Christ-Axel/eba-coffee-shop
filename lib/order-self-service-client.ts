// lib/order-self-service-client.ts
//
// Appels du libre-service client depuis la page de suivi
// (`app/api/commandes/[id]/{annulation,articles,creneau}`). Chaque succès
// renvoie la vue publique À JOUR, que l'appelant affiche aussitôt. Les
// erreurs arrivent avec un `code` stable (lib/orders/public-error-response.ts) ;
// le message du serveur est déjà rédigé pour le client, on le montre tel quel.

import type { PublicOrderView } from '@/lib/orders';
import type {
  CheckoutErrorCode,
  CustomerItemChange,
  SoldOutLine,
} from '@/lib/schemas/order';
import { extractApiError } from '@/lib/api-error';

export type SelfServiceOutcome =
  | { ok: true; order: PublicOrderView }
  | {
      ok: false;
      error: string;
      code?: CheckoutErrorCode;
      soldOutLines?: SoldOutLine[];
    };

async function call(
  url: string,
  method: 'POST' | 'PATCH',
  body?: unknown
): Promise<SelfServiceOutcome> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers:
        body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return {
      ok: false,
      error: 'Impossible de contacter le serveur. Vérifie ta connexion.',
    };
  }

  const data = (await res.json().catch(() => ({}))) as {
    order?: PublicOrderView | null;
    code?: CheckoutErrorCode;
    error?: unknown;
    items?: SoldOutLine[];
  };
  if (res.ok && data.order) return { ok: true, order: data.order };
  if (res.status >= 500 || !data.code) {
    return {
      ok: false,
      code: data.code,
      error:
        'Petit souci de notre côté : rien n’a été modifié. Réessaie dans un instant.',
    };
  }
  return {
    ok: false,
    code: data.code,
    error: extractApiError(data.error) ?? 'Action impossible pour le moment.',
    ...(data.items ? { soldOutLines: data.items } : {}),
  };
}

export function cancelOrder(orderId: string) {
  return call(`/api/commandes/${orderId}/annulation`, 'POST');
}

export function changeOrderItems(
  orderId: string,
  changes: CustomerItemChange[]
) {
  return call(`/api/commandes/${orderId}/articles`, 'PATCH', { changes });
}

/** `null` = « dès que possible ». */
export function rescheduleOrder(orderId: string, pickupTime: string | null) {
  return call(`/api/commandes/${orderId}/creneau`, 'PATCH', { pickupTime });
}
