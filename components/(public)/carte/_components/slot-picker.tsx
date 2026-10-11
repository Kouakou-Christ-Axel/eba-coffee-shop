'use client';

// components/(public)/carte/_components/slot-picker.tsx
//
// Étape « Pour quand ? » du checkout.
//
// Deux options, alignées sur le processus réel du comptoir :
//   - « Dès que possible » (défaut) : pas de rendez-vous, préparation
//     immédiate (pickupTime null, traité comme un walk-in) ;
//   - « Planifier » : chips de jour défilables horizontalement (au moins 7,
//     voir PICKUP_MIN_VISIBLE_DAYS) + liste verticale de créneaux, inspirées
//     du sélecteur « Schedule delivery » d'Uber Eats.
//
// Les plages d'ouverture du jour (réglages retrait, /dashboard/parametres)
// sont affichées au-dessus de la liste ; un jour fermé est annoncé comme tel.
// Les données viennent de `usePickupInfo` (fetch unique pour tout le modal).

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@heroui/react';
import { Check, Clock, RefreshCw } from 'lucide-react';
import {
  ABIDJAN_TZ,
  formatAbidjanTime,
  shiftDateString,
  todayDateString,
} from '@/lib/timezone';
import type { TimeRange } from '@/lib/pickup-settings';
import type { PickupInfoState, PickupDay } from '@/lib/hooks/use-pickup-info';
import type { PickupTiming } from '@/lib/hooks/use-checkout-form';
import {
  isAvailableToday,
  isWithinAnyPeriod,
  minAllowedPickupDateString,
} from '@/lib/supplements';
import { pickDefaultSlot } from '@/lib/pickup-slots';
import { DEFERRED_PICKUP_DEFAULT_TIME } from '@/config/constants';
import type { CartItem } from '@/lib/cart-store';
import { precommandeDay } from '@/lib/cart-precommande';
import { cn } from '@/lib/utils';
import { DayChips, DaySlots } from './slot-picker-day-view';
import { PickupModeToggle } from './pickup-mode-toggle';

type SlotPickerProps = {
  timing: PickupTiming;
  onTimingChange: (timing: PickupTiming) => void;
  value: string | null;
  onChange: (iso: string) => void;
  error?: string;
  info: PickupInfoState;
  /** Panier courant : sert à retirer du sélecteur les jours où un article
   * (planning récurrent `availableDays` et/ou fenêtre « spécialité de la
   * semaine » `weeklySpecialPeriods`, snapshotés sur `CartItem` à l'ajout —
   * voir lib/cart-store.ts) ne serait pas disponible. Confort uniquement :
   * la vérité reste revérifiée côté serveur par produit (lib/orders.ts). */
  items: CartItem[];
  /** Délai de commande à l'avance requis par le panier (jours), voir
   * `Product.advanceOrderDays` (lib/menu.ts). 0/absent = pas de contrainte. */
  minAdvanceOrderDays?: number;
  /**
   * La contrainte de jour vient d'un article ÉPUISÉ AUJOURD'HUI, pas d'une
   * règle « commande à l'avance » du produit. Change uniquement le message :
   * parler de commande à l'avance mentirait au client.
   */
  soldOutRestricted?: boolean;
  /**
   * La SEULE contrainte de jour vient d'articles épuisés aujourd'hui (pas
   * d'un `advanceOrderDays` générique > 1) : fige le jour sur demain, aucun
   * chip de jour à afficher — seulement le choix de l'heure. Un produit qui
   * cumule un vrai délai de commande (> 1 jour) en plus d'être épuisé retombe
   * correctement sur le régime générique (sélecteur de jour complet).
   */
  precommandePure?: boolean;
};

/** Jour civil Abidjan (YYYY-MM-DD) d'un créneau — Abidjan = UTC. */
function slotDayKey(slot: Date): string {
  return slot.toISOString().slice(0, 10);
}

/** « 26 sept. » — date courte Abidjan, pour accompagner « Retrait demain ». */
function shortDayDate(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00Z`).toLocaleDateString('fr-FR', {
    timeZone: ABIDJAN_TZ,
    day: 'numeric',
    month: 'short',
  });
}

function dayLabel(dateKey: string, today: string): string {
  if (dateKey === today) return "Aujourd'hui";
  if (dateKey === shiftDateString(today, 1)) return 'Demain';
  return new Date(`${dateKey}T00:00:00Z`).toLocaleDateString('fr-FR', {
    timeZone: ABIDJAN_TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });
}

/** Heure murale Abidjan courante « HH:MM », comparable aux plages. */
function nowAbidjanHHMM(): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: ABIDJAN_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
}

function isOpenNow(todayRanges: TimeRange[]): boolean {
  const now = nowAbidjanHHMM();
  return todayRanges.some((r) => r.start <= now && now <= r.end);
}

/** Vrai si TOUS les articles du panier sont disponibles à `date` (planning
 * récurrent ET fenêtre « spécialité de la semaine », voir lib/supplements.ts)
 * — une seule ligne indisponible bloque le jour entier, un retrait unique
 * servant tout le panier. `date` absente = maintenant (mêmes règles que
 * l'ajout au panier, voir use-quick-add.ts). */
function isCartAvailableOn(items: CartItem[], date?: Date): boolean {
  return items.every(
    (i) =>
      isAvailableToday(i.availableDays ?? null, date) &&
      isWithinAnyPeriod(i.weeklySpecialPeriods ?? null, date)
  );
}

export function SlotPicker({
  timing,
  onTimingChange,
  value,
  onChange,
  error,
  info,
  items,
  minAdvanceOrderDays = 0,
  soldOutRestricted = false,
  precommandePure = false,
}: SlotPickerProps) {
  const today = todayDateString();
  const [activeDay, setActiveDay] = useState<string | null>(null);

  const slotsByDay = useMemo(() => {
    const map = new Map<string, Date[]>();
    if (info.status !== 'ready') return map;
    for (const s of info.slots) {
      const k = slotDayKey(s);
      const arr = map.get(k) ?? [];
      arr.push(s);
      map.set(k, arr);
    }
    return map;
  }, [info]);

  // Un article du panier exige une commande à l'avance : « Dès que possible »
  // ne peut jamais satisfaire un délai en jours, et les jours trop proches
  // n'ont pas lieu d'être proposés.
  const minAllowedDate =
    minAdvanceOrderDays > 0
      ? minAllowedPickupDateString(minAdvanceOrderDays)
      : null;
  const allDays: PickupDay[] = useMemo(
    () => (info.status === 'ready' ? info.days : []),
    [info]
  );
  // Planning récurrent / fenêtre « spécialité de la semaine » (voir
  // isCartAvailableOn ci-dessus) : un jour où un article du panier ne serait
  // pas disponible n'a pas lieu d'être proposé, comme pour minAllowedDate.
  //
  // Mémoïsés (et non de simples `const` dérivées à chaque rendu) : `days` sert
  // de dépendance au `useMemo` de `defaultSlot` ci-dessous, et le compilateur
  // React refuse de préserver une mémoïsation manuelle dont une dépendance
  // n'est pas elle-même une valeur stable.
  const scheduleFilteredDays = useMemo(
    () =>
      allDays.filter((d) =>
        isCartAvailableOn(items, new Date(`${d.date}T00:00:00Z`))
      ),
    [allDays, items]
  );
  const days = useMemo(() => {
    // Précommande pure : un seul jour possible, TOUJOURS demain — pas de
    // sélecteur de jour, voir la prop `precommandePure`.
    if (precommandePure) {
      const day = precommandeDay();
      return scheduleFilteredDays.filter((d) => d.date === day);
    }
    return minAllowedDate
      ? scheduleFilteredDays.filter((d) => d.date >= minAllowedDate)
      : scheduleFilteredDays;
  }, [scheduleFilteredDays, minAllowedDate, precommandePure]);
  const scheduleRestricted = scheduleFilteredDays.length < allDays.length;
  const todayRanges = allDays.find((d) => d.date === today)?.ranges ?? [];
  const cartAvailableNow = isCartAvailableOn(items);
  const openNow = isOpenNow(todayRanges) && !minAllowedDate && cartAvailableNow;
  const selectedDay = activeDay ?? days[0]?.date ?? null;

  // Fermé en ce moment (ou délai de commande à l'avance actif) : « Dès que
  // possible » n'a pas de sens, on bascule d'office sur la planification.
  useEffect(() => {
    if (info.status === 'ready' && !openNow && timing === 'asap') {
      onTimingChange('scheduled');
    }
  }, [info.status, openNow, timing, onTimingChange]);

  // Panier contraint à un jour ultérieur (article épuisé aujourd'hui, ou délai
  // de commande à l'avance) : on POSE le créneau par défaut plutôt que de
  // laisser le client chercher. Il reste libre d'en changer.
  //
  // `pickDefaultSlot` garantit qu'on ne pré-sélectionne jamais une heure qui
  // n'existe pas (fermeture, capacité pleine, pas de créneau) — voir
  // lib/pickup-slots.ts.
  //
  // Mémoïsé et PARTAGÉ entre l'effet de pré-sélection ci-dessous et le bouton
  // de raccourci affiché au-dessus des jours (cf. rendu) : les deux doivent
  // s'accorder sur le MÊME créneau, sinon ce que le bouton propose et ce qui
  // est réellement pré-coché divergent au premier rendu ambigu.
  const firstDay = days[0]?.date ?? null;
  const defaultSlot: Date | null = useMemo(() => {
    if (info.status !== 'ready' || !minAllowedDate || !firstDay) return null;
    const candidates = days.flatMap((d) => slotsByDay.get(d.date) ?? []);
    return pickDefaultSlot(candidates, firstDay, DEFERRED_PICKUP_DEFAULT_TIME);
    // `days`/`slotsByDay` sont dérivés de `info` : le suivre suffit et évite de
    // relancer le calcul à chaque rendu sur des tableaux recréés.
  }, [info, minAllowedDate, firstDay, days, slotsByDay]);

  useEffect(() => {
    if (!value && defaultSlot) onChange(defaultSlot.toISOString());
  }, [value, defaultSlot, onChange]);

  const selectedDate = value ? new Date(value) : null;
  const selectedLabel =
    timing === 'scheduled' && selectedDate
      ? `${dayLabel(slotDayKey(selectedDate), today)} à ${formatAbidjanTime(selectedDate)}`
      : null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex w-full items-baseline justify-between">
        <p className="text-sm font-medium">Pour quand&nbsp;?</p>
        {selectedLabel && (
          <span className="flex items-center gap-1 text-xs text-primary">
            <Clock className="h-3 w-3" />
            {selectedLabel}
          </span>
        )}
      </div>

      {info.status === 'loading' ? (
        <p className="rounded-md border border-foreground/15 px-3 py-4 text-center text-xs text-foreground/50">
          Chargement des horaires…
        </p>
      ) : info.status === 'error' ? (
        <div className="flex flex-col items-center gap-2 rounded-md border border-foreground/15 px-3 py-4">
          <p className="text-center text-xs text-foreground/50">
            Impossible de charger les horaires.
          </p>
          <Button
            size="sm"
            variant="bordered"
            startContent={<RefreshCw className="h-3.5 w-3.5" />}
            onPress={info.retry}
          >
            Réessayer
          </Button>
        </div>
      ) : (
        <>
          {minAdvanceOrderDays > 0 &&
            (precommandePure ? (
              // Message court : le bandeau global « Panier précommande »
              // (precommande-banner.tsx) a déjà annoncé la contrainte plus
              // haut dans le parcours — ici, on ne fait plus que guider le
              // choix de l'heure.
              <p className="text-xs text-foreground/60">
                Choisis ton heure de retrait pour demain.
              </p>
            ) : soldOutRestricted ? (
              <p className="text-xs text-foreground/60">
                Un article de votre panier est épuisé aujourd&apos;hui : il sera
                préparé pour le jour que vous choisissez, à partir de demain.
              </p>
            ) : (
              <p className="text-xs text-foreground/60">
                Un article de votre panier doit être commandé au moins{' '}
                {minAdvanceOrderDays} jour
                {minAdvanceOrderDays > 1 ? 's' : ''} à l&apos;avance.
              </p>
            ))}

          {scheduleRestricted && (
            <p className="text-xs text-foreground/60">
              Un article de votre panier n&apos;est disponible que certains
              jours — les autres sont masqués ci-dessous.
            </p>
          )}

          <PickupModeToggle
            timing={timing}
            onTimingChange={onTimingChange}
            openNow={openNow}
            minAllowedDate={minAllowedDate}
            soldOutRestricted={soldOutRestricted}
            cartAvailableNow={cartAvailableNow}
            leadTimeMin={info.leadTimeMin}
          />

          {error && <p className="text-xs text-danger">{error}</p>}

          {timing === 'scheduled' &&
            (selectedDay ? (
              <div className="flex flex-col gap-2 pt-1">
                {/* Raccourci vers le créneau pré-sélectionné automatiquement
                 * (voir l'effet ci-dessus). Il n'existe QUE quand le panier
                 * impose déjà un jour ultérieur (`minAllowedDate`) : sans
                 * contrainte, « Dès que possible » reste le défaut et ce
                 * bouton n'a pas lieu d'être. Ce n'est pas un second chemin de
                 * sélection : c'est la matérialisation visible et réversible
                 * de la pré-sélection silencieuse — le client comprend
                 * pourquoi un créneau est déjà coché, et peut y revenir en un
                 * geste après être allé voir d'autres jours. */}
                {minAllowedDate && defaultSlot && (
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      aria-pressed={value === defaultSlot.toISOString()}
                      onClick={() => {
                        onChange(defaultSlot.toISOString());
                        setActiveDay(slotDayKey(defaultSlot));
                      }}
                      className={cn(
                        'flex w-fit items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-xs font-semibold transition-colors',
                        value === defaultSlot.toISOString()
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-foreground/10 text-foreground hover:border-primary/40 hover:bg-primary/5'
                      )}
                    >
                      {value === defaultSlot.toISOString() && (
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {dayLabel(slotDayKey(defaultSlot), today)} à{' '}
                      {formatAbidjanTime(defaultSlot)}
                    </button>
                    <p className="text-xs text-foreground/50">
                      Créneau proposé
                    </p>
                  </div>
                )}
                {precommandePure ? (
                  // Un seul jour possible : pas de chips à faire défiler,
                  // juste le rappel du jour avant la liste d'heures.
                  <p className="text-xs font-medium text-foreground/70">
                    Retrait demain, {shortDayDate(selectedDay)}
                  </p>
                ) : (
                  <DayChips
                    days={days}
                    today={today}
                    activeDay={selectedDay}
                    onSelect={setActiveDay}
                  />
                )}
                <DaySlots
                  day={days.find((d) => d.date === selectedDay) ?? days[0]}
                  slots={slotsByDay.get(selectedDay) ?? []}
                  selected={value}
                  onSelect={onChange}
                />
              </div>
            ) : (
              <p className="py-3 text-center text-xs text-foreground/50">
                Aucun jour disponible pour un article de votre panier dans les
                prochains jours.
              </p>
            ))}
        </>
      )}
    </div>
  );
}

