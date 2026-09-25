// lib/order-self-service-rate-limit.ts
//
// Anti-abus des routes de libre-service client
// (`app/api/commandes/[id]/{annulation,articles,creneau}`). Clé
// `ip:orderId` (même convention que lib/payment-proof-rate-limit.ts) : freine
// les rafales sur UNE commande sans pénaliser un autre client du même réseau.
// Mémoire du process, pas de garantie multi-instance (cf. lib/rate-limit.ts) :
// le vrai rempart reste la garde d'éligibilité côté serveur.

import { createRateLimiter } from './rate-limit';

const WINDOW_MS = 10 * 60_000; // 10 minutes
const MAX_HITS_PER_WINDOW = 10;

export const allowOrderSelfService = createRateLimiter(
  WINDOW_MS,
  MAX_HITS_PER_WINDOW
);

/** Clé de limitation d'une requête sur la commande `orderId`. */
export function selfServiceRateKey(req: Request, orderId: string): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  const ip = forwardedFor?.split(',')[0]?.trim() || 'unknown';
  return `${ip}:${orderId}`;
}
