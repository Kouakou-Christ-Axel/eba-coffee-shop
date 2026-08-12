'use client';

/**
 * Bandeau visible signalant une déconnexion prolongée (`isStale`, cf.
 * `use-orders-stream.ts`) — contrairement à `ConnectionBadge` (pastille
 * discrète, masquée sous `sm`), c'est une alerte forte : au-delà du seuil,
 * le caissier doit savoir que les commandes affichées peuvent être obsolètes.
 */
export function StaleDataBanner({ isStale }: { isStale: boolean }) {
  if (!isStale) return null;
  return (
    <div
      role="alert"
      className="w-full rounded-lg bg-red-600 px-4 py-2 text-center text-sm font-semibold text-white"
    >
      Connexion perdue — les données affichées peuvent être obsolètes. Nouvelle
      tentative en cours…
    </div>
  );
}
