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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@heroui/react';
import {
  CalendarClock,
  ChevronRight,
  Clock,
  RefreshCw,
  Zap,
} from 'lucide-react';
import {
  ABIDJAN_TZ,
  formatAbidjanTime,
  shiftDateString,
  todayDateString,
} from '@/lib/timezone';
import { WEEKDAY_LABELS, type TimeRange } from '@/lib/pickup-settings';
import type { PickupInfoState, PickupDay } from '@/lib/hooks/use-pickup-info';
import type { PickupTiming } from '@/lib/hooks/use-checkout-form';
import {
  isAvailableToday,
  isWithinAnyPeriod,
  minAllowedPickupDateString,
} from '@/lib/supplements';
import type { CartItem } from '@/lib/cart-store';
import { cn } from '@/lib/utils';

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
};

type Period = 'morning' | 'noon' | 'afternoon' | 'evening';

const PERIOD_ORDER: readonly Period[] = [
  'morning',
  'noon',
  'afternoon',
  'evening',
] as const;

const PERIOD_LABELS: Record<Period, string> = {
  morning: 'Matin',
  noon: 'Midi',
  afternoon: 'Après-midi',
  evening: 'Soir',
};

function periodOf(slot: Date): Period {
  const h = slot.getUTCHours(); // Abidjan = UTC
  if (h < 12) return 'morning';
  if (h < 14) return 'noon';
  if (h < 18) return 'afternoon';
  return 'evening';
}

/** Jour civil Abidjan (YYYY-MM-DD) d'un créneau — Abidjan = UTC. */
function slotDayKey(slot: Date): string {
  return slot.toISOString().slice(0, 10);
}

/** « 07:30 » → « 7h30 » (affichage des plages d'ouverture). */
function formatRangeTime(t: string): string {
  return t.replace(/^0/, '').replace(':', 'h');
}

function formatRanges(ranges: TimeRange[]): string {
  return ranges
    .map((r) => `${formatRangeTime(r.start)} – ${formatRangeTime(r.end)}`)
    .join(', ');
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

/** Libellé court sur deux lignes pour une chip de jour (style Uber Eats). */
function dayChipLabel(
  dateKey: string,
  today: string
): { top: string; bottom: string } {
  const bottom = new Date(`${dateKey}T00:00:00Z`).toLocaleDateString('fr-FR', {
    timeZone: ABIDJAN_TZ,
    day: 'numeric',
    month: 'short',
  });
  if (dateKey === today) return { top: "Aujourd'hui", bottom };
  if (dateKey === shiftDateString(today, 1)) return { top: 'Demain', bottom };
  const weekday = new Date(`${dateKey}T00:00:00Z`).getUTCDay();
  return { top: WEEKDAY_LABELS[String(weekday)].slice(0, 3), bottom };
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
  const allDays: PickupDay[] = info.status === 'ready' ? info.days : [];
  // Planning récurrent / fenêtre « spécialité de la semaine » (voir
  // isCartAvailableOn ci-dessus) : un jour où un article du panier ne serait
  // pas disponible n'a pas lieu d'être proposé, comme pour minAllowedDate.
  const scheduleFilteredDays = allDays.filter((d) =>
    isCartAvailableOn(items, new Date(`${d.date}T00:00:00Z`))
  );
  const days = minAllowedDate
    ? scheduleFilteredDays.filter((d) => d.date >= minAllowedDate)
    : scheduleFilteredDays;
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
          {minAdvanceOrderDays > 0 && (
            <p className="text-xs text-foreground/60">
              Un article de votre panier doit être commandé au moins{' '}
              {minAdvanceOrderDays} jour
              {minAdvanceOrderDays > 1 ? 's' : ''} à l&apos;avance.
            </p>
          )}

          {scheduleRestricted && (
            <p className="text-xs text-foreground/60">
              Un article de votre panier n&apos;est disponible que certains
              jours — les autres sont masqués ci-dessous.
            </p>
          )}

          {/* Dès que possible / Planifier */}
          <div
            role="radiogroup"
            aria-label="Moment du retrait"
            className="grid grid-cols-2 gap-2"
          >
            <button
              type="button"
              role="radio"
              aria-checked={timing === 'asap'}
              disabled={!openNow}
              onClick={() => onTimingChange('asap')}
              className={cn(
                'flex flex-col items-start gap-0.5 rounded-xl border-2 px-3 py-3 text-left transition-all',
                timing === 'asap' && openNow
                  ? 'border-primary bg-primary/5'
                  : 'border-foreground/10',
                openNow
                  ? 'hover:border-primary/40 hover:bg-primary/5'
                  : 'cursor-not-allowed opacity-50'
              )}
            >
              <span
                className={cn(
                  'flex items-center gap-1.5 text-sm font-semibold',
                  timing === 'asap' && openNow
                    ? 'text-primary'
                    : 'text-foreground'
                )}
              >
                <Zap className="h-4 w-4" />
                Dès que possible
              </span>
              <span className="text-xs text-foreground/50">
                {minAllowedDate
                  ? 'Commande à l’avance requise'
                  : !cartAvailableNow
                    ? "Indisponible aujourd'hui"
                    : openNow
                      ? `Prête dans ~${info.leadTimeMin} min`
                      : 'Fermé actuellement'}
              </span>
            </button>

            <button
              type="button"
              role="radio"
              aria-checked={timing === 'scheduled'}
              onClick={() => onTimingChange('scheduled')}
              className={cn(
                'flex flex-col items-start gap-0.5 rounded-xl border-2 px-3 py-3 text-left transition-all hover:border-primary/40 hover:bg-primary/5',
                timing === 'scheduled'
                  ? 'border-primary bg-primary/5'
                  : 'border-foreground/10'
              )}
            >
              <span
                className={cn(
                  'flex items-center gap-1.5 text-sm font-semibold',
                  timing === 'scheduled' ? 'text-primary' : 'text-foreground'
                )}
              >
                <CalendarClock className="h-4 w-4" />
                Planifier
              </span>
              <span className="text-xs text-foreground/50">
                Choisir jour et heure
              </span>
            </button>
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}

          {timing === 'scheduled' &&
            (selectedDay ? (
              <div className="flex flex-col gap-2 pt-1">
                <DayChips
                  days={days}
                  today={today}
                  activeDay={selectedDay}
                  onSelect={setActiveDay}
                />
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

function DayChips({
  days,
  today,
  activeDay,
  onSelect,
}: {
  days: PickupDay[];
  today: string;
  activeDay: string;
  onSelect: (date: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollMore, setCanScrollMore] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollMore(el.scrollWidth - el.scrollLeft - el.clientWidth > 4);
  }, []);

  useEffect(() => {
    updateScrollState();
  }, [updateScrollState, days.length]);

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        onScroll={updateScrollState}
        role="tablist"
        aria-label="Jour de retrait"
        className="flex gap-2 overflow-x-auto scroll-smooth pr-9 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {days.map((d) => {
          const { top, bottom } = dayChipLabel(d.date, today);
          const selected = d.date === activeDay;
          return (
            <button
              key={d.date}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onSelect(d.date)}
              className={cn(
                'flex flex-none shrink-0 flex-col items-center gap-0.5 rounded-xl border-2 px-4 py-2 text-center transition-colors',
                selected
                  ? 'border-primary bg-primary/5'
                  : 'border-foreground/10 hover:border-primary/40'
              )}
            >
              <span
                className={cn(
                  'text-sm font-semibold',
                  selected ? 'text-primary' : 'text-foreground'
                )}
              >
                {top}
              </span>
              <span className="text-xs text-foreground/50">{bottom}</span>
            </button>
          );
        })}
      </div>
      {canScrollMore && (
        <button
          type="button"
          aria-label="Voir plus de jours"
          onClick={() =>
            scrollRef.current?.scrollBy({ left: 220, behavior: 'smooth' })
          }
          className="absolute right-0 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-foreground/15 bg-background shadow-sm"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function DaySlots({
  day,
  slots,
  selected,
  onSelect,
}: {
  day: PickupDay;
  slots: Date[];
  selected: string | null;
  onSelect: (iso: string) => void;
}) {
  if (day.ranges.length === 0) {
    return (
      <p className="py-3 text-center text-xs text-foreground/50">
        Fermé ce jour.
      </p>
    );
  }

  if (slots.length === 0) {
    return (
      <p className="py-3 text-center text-xs text-foreground/50">
        Plus de créneau disponible ce jour (ouvert&nbsp;:{' '}
        {formatRanges(day.ranges)}).
      </p>
    );
  }

  const sections = PERIOD_ORDER.map((period) => ({
    period,
    slots: slots.filter((s) => periodOf(s) === period),
  })).filter((s) => s.slots.length > 0);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-foreground/50">
        Ouvert&nbsp;: {formatRanges(day.ranges)}
      </p>
      <div
        role="radiogroup"
        aria-label="Heure de retrait"
        className="max-h-64 overflow-y-auto rounded-lg border border-foreground/10"
      >
        {sections.map(({ period, slots: inPeriod }) => (
          <div key={period}>
            <p className="px-3 pt-3 pb-1 text-xs font-medium text-foreground/50">
              {PERIOD_LABELS[period]}
            </p>
            {inPeriod.map((slot) => {
              const iso = slot.toISOString();
              const isSelected = selected === iso;
              return (
                <button
                  key={iso}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => onSelect(iso)}
                  className="flex w-full items-center justify-between border-b border-foreground/10 px-3 py-3 text-left transition-colors last:border-0 hover:bg-primary/5"
                >
                  <span className="text-sm">{formatAbidjanTime(slot)}</span>
                  <span
                    className={cn(
                      'flex h-4 w-4 flex-none items-center justify-center rounded-full border-2',
                      isSelected
                        ? 'border-primary bg-primary'
                        : 'border-foreground/25'
                    )}
                  >
                    {isSelected && (
                      <span className="h-1.5 w-1.5 rounded-full bg-background" />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
