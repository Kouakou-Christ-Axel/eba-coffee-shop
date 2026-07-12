// Helpers de minuteur pour l'écran cuisine (KDS).
//
// Chrono « temps écoulé » : simple compteur croissant depuis un instant (entrée
// en cuisine, ou passage prête). Pas de cible/compte à rebours — seuils de
// couleur uniquement (choix produit : « chrono simple »).

import { differenceInSeconds } from 'date-fns';

export type ElapsedTone = 'calm' | 'warn' | 'alert';

// Seuils du chrono « en cuisine depuis X » (minutes) : attention puis alerte.
// Partagés par la carte de préparation et le bottom sheet de détail.
export const KITCHEN_WARN_MIN = 12;
export const KITCHEN_ALERT_MIN = 20;

/** Classes Tailwind du chip de chrono cuisine, par palier de couleur. */
export const TONE_CLASS: Record<ElapsedTone, string> = {
  calm: 'bg-muted text-muted-foreground',
  warn: 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-100',
  alert: 'bg-red-100 text-red-900 dark:bg-red-950/60 dark:text-red-100',
};

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
