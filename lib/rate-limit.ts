// lib/rate-limit.ts
//
// Fabrique de limiteurs de débit en mémoire (fenêtre glissante simple), pour
// ralentir un abus grossier sur des endpoints publics sensibles (coût d'API
// externe, spam...).
//
// ⚠️ LIMITE CONNUE : chaque limiteur créé ici vit dans la mémoire du process
// Node. Sur un déploiement serverless multi-instances (plusieurs lambdas
// concurrentes), il n'offre AUCUNE garantie globale — chaque instance a son
// propre compteur. Ce n'est PAS un rempart de sécurité strict, seulement un
// frein contre un script qui spamme depuis une même instance. À remplacer
// par un compteur partagé (Redis/Upstash) si le trafic ou l'infra de
// déploiement le justifie un jour.

type Bucket = { count: number; windowStart: number };

/**
 * Crée un limiteur indépendant (son propre `Map` de compteurs). `windowMs`
 * est la durée de la fenêtre glissante, `maxHitsPerWindow` le nombre d'appels
 * autorisés par clé sur cette fenêtre.
 */
export function createRateLimiter(
  windowMs: number,
  maxHitsPerWindow: number
) {
  const buckets = new Map<string, Bucket>();

  /** Nettoyage périodique pour éviter une fuite mémoire sur un process long-lived. */
  function sweep(now: number) {
    for (const [key, bucket] of buckets) {
      if (now - bucket.windowStart > windowMs) buckets.delete(key);
    }
  }

  /**
   * Renvoie `true` si l'appel est autorisé (et l'enregistre), `false` s'il
   * dépasse le quota de la fenêtre courante.
   */
  return function allow(key: string): boolean {
    const now = Date.now();
    if (buckets.size > 1000) sweep(now);

    const bucket = buckets.get(key);
    if (!bucket || now - bucket.windowStart > windowMs) {
      buckets.set(key, { count: 1, windowStart: now });
      return true;
    }
    if (bucket.count >= maxHitsPerWindow) return false;
    bucket.count += 1;
    return true;
  };
}
