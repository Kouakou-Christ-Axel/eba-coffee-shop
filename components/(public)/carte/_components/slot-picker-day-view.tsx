// components/(public)/carte/_components/slot-picker-day-view.tsx
//
// Chips de jour + liste de créneaux du `SlotPicker` (régime « commande à
// l'avance » générique, sélecteur de jour légitime) — extraites dans ce
// fichier séparé pour garder slot-picker.tsx sous le seuil de 300 lignes
// (CLAUDE.md) après l'ajout du régime « précommande pure ».

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { ABIDJAN_TZ, formatAbidjanTime, shiftDateString } from '@/lib/timezone';
import { WEEKDAY_LABELS, type TimeRange } from '@/lib/pickup-settings';
import type { PickupDay } from '@/lib/hooks/use-pickup-info';
import { cn } from '@/lib/utils';

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

/** « 07:30 » → « 7h30 » (affichage des plages d'ouverture). */
function formatRangeTime(t: string): string {
  return t.replace(/^0/, '').replace(':', 'h');
}

function formatRanges(ranges: TimeRange[]): string {
  return ranges
    .map((r) => `${formatRangeTime(r.start)} – ${formatRangeTime(r.end)}`)
    .join(', ');
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

export function DayChips({
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

export function DaySlots({
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
