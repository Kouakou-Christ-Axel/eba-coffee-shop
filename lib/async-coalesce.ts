// lib/async-coalesce.ts
//
// Mutualisation d'un travail asynchrone identique lancé en concurrence
// (« in-flight request coalescing »). Utile pour les endpoints SSE partagés par
// plusieurs clients (caisse, cuisine…) : une notification déclenche un recalcul
// par client connecté, alors que tous reçoivent le MÊME instantané.
//
// Volontairement SANS TTL : un cache à durée de vie introduirait de la
// péremption dans un flux temps réel (file de caisse, KDS…).
//
// Mais « pas de TTL » ne suffit pas. Partager naïvement toute promesse en vol
// est FAUX ici, et d'une façon qui se voit en caisse :
//
//   T=0    commande A → notification → les clients temporisent, tirent à T=150
//   T=150  calcul F1 démarre, partagé par tous les clients  (le gain recherché)
//   T=160  commande B → notification → les clients tirent à T=310
//   T=310  F1 tourne encore (~6 requêtes, c'est plausible sous charge) :
//          les clients rejoignent F1…
//   T=350  …qui résout avec des données antérieures à B.
//
// Plus aucune notification ne suit : **la commande B n'apparaît jamais** à la
// caisse (ni carte, ni carillon) jusqu'au prochain changement. Un appel arrivé
// APRÈS le début d'un calcul ne peut donc pas réutiliser son résultat.
//
// D'où la mutualisation par CLÉ (ici la « génération » de notification, cf.
// `getOrdersGeneration` dans lib/postgres-notify.ts) : les appels déclenchés
// par la MÊME notification partagent le travail ; un appel déclenché par une
// notification plus récente porte une clé différente et relance un calcul frais.

/**
 * Enveloppe `fn` pour que les appels concurrents portant la MÊME clé partagent
 * une seule exécution. Un appel portant une clé différente relance toujours
 * `fn`, même si un calcul est encore en vol.
 *
 * `getKey` est lu au moment de l'appel. Dès que la promesse résout (succès OU
 * échec), l'état « en vol » est libéré : rien n'est mémorisé au-delà.
 */
export function coalesceAsyncByKey<T>(
  fn: () => Promise<T>,
  getKey: () => number | string
): () => Promise<T> {
  let inFlight: { key: number | string; promise: Promise<T> } | null = null;

  return () => {
    const key = getKey();
    if (inFlight && inFlight.key === key) return inFlight.promise;

    const promise = fn().finally(() => {
      // Ne libère que si c'est toujours CETTE exécution qui est enregistrée :
      // une exécution plus récente (clé différente) a pu prendre sa place.
      if (inFlight?.promise === promise) inFlight = null;
    });
    inFlight = { key, promise };
    return promise;
  };
}
