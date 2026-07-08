// lib/poll-rate-limit.ts
//
// Anti-abus léger pour les actions publiques de sondage (vote, suggestion) :
// compteur en mémoire par clé (ex. `ip:pollId`), fenêtre glissante simple.
//
// ⚠️ LIMITE CONNUE : ce compteur vit dans la mémoire du process Node. Sur un
// déploiement serverless multi-instances (plusieurs lambdas concurrentes), il
// n'offre AUCUNE garantie globale — chaque instance a son propre compteur.
// Ce n'est PAS le rempart de sécurité : le vrai garde-fou anti-doublon reste
// la contrainte unique en base (PollVote.pollId_voterPhone / pollId_voterToken).
// Ce module ne fait que ralentir un abus grossier (script qui spamme), rien
// de plus. À remplacer par un compteur partagé (Redis/Upstash) si le trafic
// ou l'infra de déploiement le justifie un jour.

const WINDOW_MS = 60_000;
const MAX_HITS_PER_WINDOW = 10;

type Bucket = { count: number; windowStart: number };

const buckets = new Map<string, Bucket>();

/** Nettoyage périodique pour éviter une fuite mémoire sur un process long-lived. */
function sweep(now: number) {
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart > WINDOW_MS) buckets.delete(key);
  }
}

/**
 * Renvoie `true` si l'appel est autorisé (et l'enregistre), `false` s'il
 * dépasse le quota de la fenêtre courante.
 */
export function allowPollAction(key: string): boolean {
  const now = Date.now();
  if (buckets.size > 1000) sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now });
    return true;
  }
  if (bucket.count >= MAX_HITS_PER_WINDOW) return false;
  bucket.count += 1;
  return true;
}
