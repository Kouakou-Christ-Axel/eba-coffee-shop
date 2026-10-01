// lib/order-create-rate-limit.ts
//
// Anti-abus de la création de commande publique (`POST /api/commandes`).
// Clé IP seule (pas d'orderId : la commande n'existe pas encore) — même
// convention que lib/order-self-service-rate-limit.ts. Mémoire du process,
// pas de garantie multi-instance (cf. lib/rate-limit.ts) : freine un script
// qui spamme depuis une même instance, pas un rempart strict.

import { createRateLimiter } from './rate-limit';

const WINDOW_MS = 10 * 60_000; // 10 minutes
const MAX_HITS_PER_WINDOW = 5;

export const allowOrderCreate = createRateLimiter(
  WINDOW_MS,
  MAX_HITS_PER_WINDOW
);

/** Clé de limitation d'une requête de création de commande. */
export function orderCreateRateKey(req: Request): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  return forwardedFor?.split(',')[0]?.trim() || 'unknown';
}
