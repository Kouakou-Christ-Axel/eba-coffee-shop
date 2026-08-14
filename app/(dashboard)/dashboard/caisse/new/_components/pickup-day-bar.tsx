'use client';

// « Pour quand ? » — le choix qui doit précéder le catalogue.
//
// Pourquoi en HAUT de l'écran, et pas seulement au récapitulatif : tant que la
// date de retrait est inconnue, le catalogue ne peut pas savoir s'il doit
// bloquer un produit épuisé. Le caissier tapait donc une tuile grisée, sans
// comprendre pourquoi une commande pour demain lui était refusée.
//
// Par défaut sur « Maintenant » : le walk-in — l'écrasante majorité des
// commandes — ne voit aucun changement et ne perd pas un geste. La barre ne
// coûte quelque chose qu'à celui qui en a besoin.
//
// UN SEUL composant, monté à deux endroits (haut du catalogue en `compact`,
// récapitulatif en `full`), branché sur le MÊME état `pickupTime`. Deux
// contrôles distincts finiraient forcément par diverger.

import { CalendarClock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { isoToAbidjanDatetimeLocal, shiftDateString } from '@/lib/timezone';
import { pickupDayString, pickupISOAt } from '@/lib/orders/scheduling';
import { DEFERRED_PICKUP_DEFAULT_TIME } from '@/config/constants';
import { TimeChip } from '../../../_components/time-chip';

/** Créneau par défaut d'un retrait « plus tard aujourd'hui » : maintenant + 1 h. */
const TODAY_LATER_OFFSET_MIN = 60;

export type PickupChip = 'now' | 'today-later' | 'tomorrow' | 'other';

/**
 * Puce active, DÉRIVÉE de `pickupTime` — jamais stockée en parallèle. Un état
 * dupliqué se désynchroniserait de la valeur réellement soumise (et c'est elle
 * qui compte).
 */
export function resolvePickupChip(pickupTime: string | null): PickupChip {
  if (!pickupTime) return 'now';
  const day = isoToAbidjanDatetimeLocal(pickupTime).slice(0, 10);
  const today = pickupDayString(0);
  if (day === today) return 'today-later';
  if (day === shiftDateString(today, 1)) return 'tomorrow';
  return 'other';
}

type Props = {
  pickupTime: string | null;
  onChange: (iso: string | null) => void;
  /**
   * `compact` : puces seules, au-dessus du catalogue.
   * `full`    : puces + heure exacte, au récapitulatif.
   */
  variant?: 'compact' | 'full';
  className?: string;
};

export function PickupDayBar({
  pickupTime,
  onChange,
  variant = 'compact',
  className,
}: Props) {
  const today = pickupDayString(0);
  const chip = resolvePickupChip(pickupTime);
  const currentLocal = isoToAbidjanDatetimeLocal(pickupTime);
  const currentDay = currentLocal.slice(0, 10);
  // On conserve l'heure déjà saisie en changeant de jour : le caissier qui a
  // réglé 15h30 puis bascule de « Demain » à « Autre date » ne doit pas la
  // ressaisir.
  const currentTime = currentLocal.slice(11, 16) || DEFERRED_PICKUP_DEFAULT_TIME;

  function selectDay(day: string | null) {
    if (day === null) {
      onChange(null);
      return;
    }
    const time =
      day === today
        ? isoToAbidjanDatetimeLocal(
            new Date(Date.now() + TODAY_LATER_OFFSET_MIN * 60_000)
          ).slice(11, 16)
        : currentTime;
    onChange(pickupISOAt(day, time));
  }

  const chips: { key: PickupChip; label: string; onSelect: () => void }[] = [
    { key: 'now', label: 'Maintenant', onSelect: () => selectDay(null) },
    {
      key: 'today-later',
      label: "Plus tard aujourd'hui",
      onSelect: () => selectDay(today),
    },
    {
      key: 'tomorrow',
      label: 'Demain',
      onSelect: () => selectDay(shiftDateString(today, 1)),
    },
    {
      key: 'other',
      label: 'Autre date',
      // Point de départ raisonnable : après-demain. Le champ date en dessous
      // permet ensuite d'aller où l'on veut.
      onSelect: () => selectDay(shiftDateString(today, 2)),
    },
  ];

  return (
    <div className={cn('rounded-xl border bg-card p-3', className)}>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
        Retrait
      </p>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Jour de retrait">
        {chips.map((c) => (
          <TimeChip
            key={c.key}
            size="sm"
            onPress={c.onSelect}
            isActive={chip === c.key}
          >
            {c.label}
          </TimeChip>
        ))}
      </div>

      {/* Choix précis : visible dès qu'on n'est plus sur « Maintenant ». En
          `compact` on ne montre que la date (le catalogue n'a besoin que du
          jour) ; l'heure exacte se règle au récapitulatif. */}
      {pickupTime && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="grid gap-1">
            <Label htmlFor="pickup-day" className="text-xs text-muted-foreground">
              Jour
            </Label>
            <Input
              id="pickup-day"
              type="date"
              value={currentDay}
              min={today}
              onChange={(e) => {
                if (e.target.value) selectDay(e.target.value);
              }}
            />
          </div>
          {variant === 'full' && (
            <div className="grid gap-1">
              <Label
                htmlFor="pickup-hour"
                className="text-xs text-muted-foreground"
              >
                Heure
              </Label>
              <Input
                id="pickup-hour"
                type="time"
                value={currentTime}
                onChange={(e) => {
                  const iso = pickupISOAt(currentDay, e.target.value);
                  if (iso) onChange(iso);
                }}
              />
            </div>
          )}
        </div>
      )}

      {chip !== 'now' && chip !== 'today-later' && (
        <p className="mt-2 text-xs font-medium text-primary">
          Commande pour un autre jour — le stock d’aujourd’hui ne sera pas
          décompté.
        </p>
      )}
    </div>
  );
}
