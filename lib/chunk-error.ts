// Après un déploiement, les chunks `/_next/static/chunks/*.js` référencés par
// une page déjà ouverte (ou servie depuis le cache HTTP du navigateur) sont
// remplacés par de nouveaux fichiers hashés — les anciens n'existent plus sur
// le serveur. La requête renvoie alors une page d'erreur (500/404) au lieu du
// script, ce qui déclenche un `ChunkLoadError` côté navigateur (souvent
// accompagné d'un rejet MIME, le serveur renvoyant du HTML/texte). Le bouton
// « Réessayer » des `error.tsx` ne corrige rien : `reset()` ne fait que
// re-rendre React, sans recharger le bundle JS déjà chargé en mémoire — d'où
// le symptôme « ça marche sur un autre appareil, pas sur celui resté ouvert ».
const RELOAD_FLAG = 'eba:chunk-error-reload';

export function isChunkLoadError(error: Error & { digest?: string }) {
  return (
    error.name === 'ChunkLoadError' ||
    /Loading chunk [\w-]+ failed/i.test(error.message) ||
    /Failed to load chunk/i.test(error.message) ||
    /Importing a module script failed/i.test(error.message)
  );
}

// Recharge la page une seule fois par onglet : si le chunk manque vraiment
// (déploiement cassé) plutôt qu'à cause d'un cache client périmé, on évite
// une boucle de rechargements infinie et on retombe sur l'UI d'erreur.
export function reloadOnChunkError(error: Error & { digest?: string }) {
  if (typeof window === 'undefined' || !isChunkLoadError(error)) return false;
  if (window.sessionStorage.getItem(RELOAD_FLAG) === '1') return false;
  window.sessionStorage.setItem(RELOAD_FLAG, '1');
  window.location.reload();
  return true;
}

// Marque la session comme saine une fois qu'une page a fini de s'hydrater :
// un futur `ChunkLoadError` (nouveau déploiement) pourra de nouveau
// déclencher un rechargement automatique.
export function markChunkLoadHealthy() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(RELOAD_FLAG);
}
