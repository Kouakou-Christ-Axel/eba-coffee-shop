import {
  DEFAULT_SETTINGS,
  getRangesForDay,
  type PickupSettings,
  type TimeRange,
} from '@/lib/pickup-settings';
import { formatLocalDateOnly } from '@/lib/timezone';

/**
 * Pure: generates pickup slot candidates from settings.
 * A slot is included only if its timestamp is >= now + leadTimeMin minutes.
 * Does NOT enforce per-slot capacity — use getAvailablePickupSlots (server-only).
 */
export function generatePickupSlots(
  now: Date,
  settings: PickupSettings = DEFAULT_SETTINGS
): Date[] {
  const slots: Date[] = [];
  const minTime = now.getTime() + settings.leadTimeMin * 60_000;
  const intervalMs = settings.slotIntervalMin * 60_000;

  for (let dayOffset = 0; dayOffset < settings.visibleDays; dayOffset++) {
    const day = new Date(now);
    day.setDate(day.getDate() + dayOffset);
    day.setHours(0, 0, 0, 0);

    const ranges = getRangesForDay(day, settings);
    for (const range of ranges) {
      const [startH, startM] = range.start.split(':').map(Number);
      const [endH, endM] = range.end.split(':').map(Number);

      const rangeStart = new Date(day);
      rangeStart.setHours(startH, startM, 0, 0);
      const rangeEnd = new Date(day);
      rangeEnd.setHours(endH, endM, 0, 0);

      for (
        let t = rangeStart.getTime();
        t <= rangeEnd.getTime();
        t += intervalMs
      ) {
        if (t >= minTime) {
          slots.push(new Date(t));
        }
      }
    }
  }

  return slots;
}

/**
 * Créneau à pré-sélectionner pour un retrait « à partir de tel jour, vers telle
 * heure ». Pur, donc testable seul.
 *
 * Pourquoi ce n'est pas un simple `new Date(jour + heure)` : l'heure voulue
 * n'est PAS forcément un créneau réel. Le commerce peut être fermé à ce
 * moment-là, le pas de créneau peut tomber à côté, le délai de préparation
 * peut l'exclure, ou la capacité peut être pleine. Poser une valeur qui
 * n'existe pas dans la liste ferait afficher un créneau que le client ne
 * pourrait jamais valider.
 *
 * Stratégie : l'heure exacte si elle existe ; sinon le créneau le plus proche
 * APRÈS (on ne fait pas venir le client plus tôt que ce qu'on lui a proposé) ;
 * sinon le plus proche avant ; sinon le premier créneau d'un jour suivant.
 * `null` si aucun créneau n'est disponible du tout.
 */
export function pickDefaultSlot(
  slots: Date[],
  fromDay: string,
  preferredTime: string
): Date | null {
  const eligible = slots
    .filter((s) => formatLocalDateOnly(s) >= fromDay)
    .sort((a, b) => a.getTime() - b.getTime());
  if (eligible.length === 0) return null;

  const firstDay = formatLocalDateOnly(eligible[0]);
  const sameDay = eligible.filter((s) => formatLocalDateOnly(s) === firstDay);

  const [h, m] = preferredTime.split(':').map(Number);
  const target = new Date(sameDay[0]);
  // `setUTCHours` et non `setHours` : cette fonction tourne dans le NAVIGATEUR
  // du client. `setHours` interpréterait « 11:00 » dans le fuseau du visiteur —
  // sur un navigateur à UTC+2, l'heure visée deviendrait 09h Abidjan et le
  // créneau pré-sélectionné serait faux. Abidjan = UTC (cf. lib/timezone.ts).
  target.setUTCHours(h, m ?? 0, 0, 0);
  const targetMs = target.getTime();

  return (
    sameDay.find((s) => s.getTime() === targetMs) ??
    sameDay.find((s) => s.getTime() > targetMs) ??
    // Rien après : le dernier créneau du jour est le plus proche avant.
    sameDay[sameDay.length - 1]
  );
}

/**
 * Même question que `pickDefaultSlot` — « quel créneau proposer par défaut ? » —
 * mais posée à partir des PLAGES D'OUVERTURE et non de créneaux concrets.
 *
 * Pourquoi les deux coexistent : la carte publique choisit parmi les créneaux
 * réservables (`getAvailablePickupSlots`, délai de préparation et capacité déjà
 * appliqués). Les raccourcis du dashboard, eux, ne doivent respecter que les
 * jours et heures d'OUVERTURE : le délai et la capacité sont des garde-fous de
 * la commande en ligne, pas de la caisse — le staff doit pouvoir programmer un
 * retrait que le formulaire public refuserait.
 *
 * Stratégie, calquée sur `pickDefaultSlot` : `preferredTime` si une plage la
 * contient ; sinon le début de la première plage qui commence APRÈS (on ne fait
 * pas venir le client plus tôt qu'annoncé) ; sinon la fin de la dernière plage
 * du jour. Un jour sans plage est FERMÉ : on passe au suivant. `null` si aucun
 * jour ouvert — l'appelant masque alors le raccourci plutôt que de proposer une
 * date impossible.
 *
 * Comparaisons de chaînes `HH:MM` uniquement (elles sont ordonnées
 * lexicographiquement) : aucune `Date`, donc aucune sensibilité au fuseau du
 * navigateur.
 */
export function pickOpenDayTime(
  days: { date: string; ranges: TimeRange[] }[],
  fromDate: string,
  preferredTime: string
): { date: string; time: string } | null {
  const eligible = days
    .filter((d) => d.date >= fromDate && d.ranges.length > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (eligible.length === 0) return null;

  const day = eligible[0];
  const ranges = [...day.ranges].sort((a, b) => a.start.localeCompare(b.start));

  const containing = ranges.find(
    (r) => r.start <= preferredTime && preferredTime <= r.end
  );
  if (containing) return { date: day.date, time: preferredTime };

  const after = ranges.find((r) => r.start > preferredTime);
  if (after) return { date: day.date, time: after.start };

  // L'heure voulue est passée pour ce jour-là : la fermeture est ce qu'il
  // reste de plus proche.
  return { date: day.date, time: ranges[ranges.length - 1].end };
}
