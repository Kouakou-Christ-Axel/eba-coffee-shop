// Helpers de minuteur pour l'écran cuisine (KDS).
//
// Chrono « temps écoulé » : simple compteur croissant depuis un instant (entrée
// en cuisine, ou passage prête). Pas de cible/compte à rebours — seuils de
// couleur uniquement (choix produit : « chrono simple »).

import { differenceInSeconds } from 'date-fns';

export type ElapsedTone = 'calm' | 'warn' | 'alert';

/** Minutes écoulées (entier, borné à 0) entre `from` et `now`. */
export function elapsedMinutes(from: Date, now: Date): number {
  return Math.max(0, Math.floor(differenceInSeconds(now, from) / 60));
}

/** Format compact : « 3 min », « 1 h 05 ». */
export function formatElapsed(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h} h ${String(m).padStart(2, '0')}`;
}

/**
 * Palier de couleur d'un chrono selon deux seuils (minutes). En-deçà du premier
 * = calme, entre les deux = attention, au-delà = alerte.
 */
export function elapsedTone(
  minutes: number,
  warnAt: number,
  alertAt: number
): ElapsedTone {
  if (minutes >= alertAt) return 'alert';
  if (minutes >= warnAt) return 'warn';
  return 'calm';
}
