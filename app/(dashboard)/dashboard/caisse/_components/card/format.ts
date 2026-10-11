import { ABIDJAN_TZ } from '@/lib/timezone';

export const priceFormatter = new Intl.NumberFormat('fr-FR');

// « sam. 05/07 » — pour dater le n° du jour d'une commande d'un AUTRE jour
// (le #003 repart à 1 chaque matin : sans la date, deux jours se confondent).
export const dayFormatter = new Intl.DateTimeFormat('fr-FR', {
  timeZone: ABIDJAN_TZ,
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
});
