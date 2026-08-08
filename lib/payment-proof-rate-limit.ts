// lib/payment-proof-rate-limit.ts
//
// Anti-abus sur le déclenchement de l'analyse IA d'une preuve de paiement
// (lib/ai/payment-proof.ts, appelée depuis
// app/api/commandes/[id]/preuve-paiement) : contrairement au vote de sondage,
// chaque déclenchement coûte 1 à 2 requêtes OpenRouter facturées et peut même
// poser un encaissement automatique — un réupload répété sur la même
// commande (variations d'image pour tenter de faire basculer le verdict) a
// donc un coût réel, pas seulement un risque de spam.
//
// Clé = `ip:orderId` (même convention que lib/poll-rate-limit.ts) : ralentit
// les tentatives répétées sur UNE commande sans pénaliser un autre client qui
// uploade sa propre preuve au même moment depuis le même réseau (WiFi
// boutique partagé). Même limite connue que lib/rate-limit.ts (mémoire du
// process, pas de garantie multi-instance) — ce n'est pas le rempart
// ultime : l'encaissement automatique reste réversible en un clic côté
// caisse (cf. order-card-actions.tsx).

import { createRateLimiter } from './rate-limit';

const WINDOW_MS = 10 * 60_000; // 10 minutes
const MAX_HITS_PER_WINDOW = 3;

export const allowPaymentProofAnalysis = createRateLimiter(
  WINDOW_MS,
  MAX_HITS_PER_WINDOW
);
