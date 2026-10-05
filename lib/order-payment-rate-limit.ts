// lib/order-payment-rate-limit.ts
//
// Anti-abus des routes de paiement en ligne
// (`app/api/commandes/[id]/paiement` et `.../paiement/verifier`). Clé `ip:orderId`
// (même convention que lib/order-self-service-rate-limit.ts) : freine les rafales
// sur UNE commande sans pénaliser un autre client du même réseau. Mémoire du
// process, pas de garantie multi-instance (cf. lib/rate-limit.ts) : le vrai
// rempart reste la garde d'éligibilité côté serveur (lib/jeko/start-payment.ts).
//
// Deux plafonds : relancer un paiement est rare ; la vérification, elle, est
// appelée régulièrement par la page de suivi tant que le paiement est en cours.

import { createRateLimiter } from './rate-limit';
import { selfServiceRateKey } from './order-self-service-rate-limit';

const WINDOW_MS = 10 * 60_000; // 10 minutes

/** Relances de paiement : 10 par fenêtre et par commande. */
export const allowPaymentStart = createRateLimiter(WINDOW_MS, 10);

/** Vérifications au retour : 30 par fenêtre (une toutes les 20 s en moyenne). */
export const allowPaymentVerify = createRateLimiter(WINDOW_MS, 30);

export const paymentRateKey = selfServiceRateKey;
