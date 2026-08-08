// lib/poll-rate-limit.ts
//
// Anti-abus léger pour les actions publiques de sondage (vote, suggestion) :
// compteur en mémoire par clé (ex. `ip:pollId`), fenêtre glissante simple
// (cf. lib/rate-limit.ts pour la mécanique et sa limite connue).
//
// ⚠️ Ce n'est PAS le rempart de sécurité : le vrai garde-fou anti-doublon
// reste la contrainte unique en base (PollVote.pollId_voterPhone /
// pollId_voterToken). Ce module ne fait que ralentir un abus grossier
// (script qui spamme), rien de plus.

import { createRateLimiter } from './rate-limit';

const WINDOW_MS = 60_000;
const MAX_HITS_PER_WINDOW = 10;

export const allowPollAction = createRateLimiter(
  WINDOW_MS,
  MAX_HITS_PER_WINDOW
);
