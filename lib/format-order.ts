import { formatAbidjanDateTime } from '@/lib/timezone';

/**
 * Créneau de retrait pour l'affichage public : « Dimanche 10 mai · 14h30 ».
 * Toujours en heure Abidjan (déterministe quel que soit le fuseau du runtime),
 * première lettre capitalisée.
 */
export function formatPickupTime(date: Date): string {
  const s = formatAbidjanDateTime(date);
  return s.charAt(0).toUpperCase() + s.slice(1);
}
