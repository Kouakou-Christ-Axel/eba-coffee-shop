// lib/async-coalesce.ts
//
// Mutualisation d'un travail asynchrone identique lancé en concurrence
// (« in-flight request coalescing »). Utile pour les endpoints SSE partagés
// par plusieurs clients (caisse, cuisine…) : une notification déclenche un
// recalcul par client connecté, alors que tous reçoivent le MÊME instantané.
//
// Volontairement SANS TTL : une fois la promesse résolue (ou rejetée), l'appel
// suivant relance un calcul frais. Un cache à durée de vie introduirait de la
// péremption dans un flux temps réel (file de caisse, KDS…), ce qui est
// inacceptable ici — seuls les appels réellement concurrents partagent le
// travail en cours.

/**
 * Enveloppe `fn` pour que les appels concurrents (lancés avant que le
 * précédent n'ait résolu) partagent la MÊME promesse au lieu de relancer
 * chacun le travail. Dès que la promesse résout (succès OU échec), l'état
 * « en vol » est libéré : l'appel suivant relance `fn` normalement.
 */
export function coalesceAsync<T>(fn: () => Promise<T>): () => Promise<T> {
  let inFlight: Promise<T> | null = null;

  return () => {
    if (inFlight) return inFlight;
    const promise = fn().finally(() => {
      // Ne libère que si c'est toujours CETTE promesse qui est en vol (garde
      // défensive, sans effet dans l'usage actuel car synchrone).
      if (inFlight === promise) inFlight = null;
    });
    inFlight = promise;
    return promise;
  };
}
