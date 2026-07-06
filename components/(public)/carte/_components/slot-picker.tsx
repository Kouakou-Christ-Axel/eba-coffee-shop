'use client';

// components/(public)/carte/_components/slot-picker.tsx
//
// Étape « Pour quand ? » du checkout.
//
// Deux options, alignées sur le processus réel du comptoir :
//   - « Dès que possible » (défaut) : pas de rendez-vous, préparation
//     immédiate (pickupTime null, traité comme un walk-in) ;
//   - « Planifier » : Tabs par jour + UN Select compact groupé par période
//     (Matin / Midi / Après-midi / Soir) — fini la grille de ~50 boutons.
//
// Les plages d'ouverture du jour (réglages retrait, /dashboard/parametres)
// sont affichées au-dessus du Select ; un jour fermé est annoncé comme tel.
// Les données viennent de `usePickupInfo` (fetch unique pour tout le modal).

import { useEffect, useMemo, useState } from 'react';
import { Select, SelectItem, SelectSection } from '@heroui/react';
import { CalendarClock, Clock, Zap } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ABIDJAN_TZ,
  formatAbidjanTime,
  shiftDateString,
  todayDateString,
} from '@/lib/timezone';
import type { TimeRange } from '@/lib/pickup-settings';
import type {
  PickupInfoState,
  PickupDay,
} from '@/lib/hooks/use-pickup-info';
import type { PickupTiming } from '@/lib/hooks/use-checkout-form';
import { cn } from '@/lib/utils';

type SlotPickerProps = {
  timing: PickupTiming;
  onTimingChange: (timing: PickupTiming) => void;
  value: string | null;
  onChange: (iso: string) => void;
  error?: string;
  info: PickupInfoState;
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

export function SlotPicker({
  timing,
  onTimingChange,
  value,
  onChange,
  error,
  info,
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

  const days: PickupDay[] = info.status === 'ready' ? info.days : [];
  const todayRanges = days.find((d) => d.date === today)?.ranges ?? [];
  const openNow = isOpenNow(todayRanges);

  // Fermé en ce moment : « Dès que possible » n'a pas de sens, on bascule
  // d'office sur la planification.
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
        <p className="rounded-md border border-foreground/15 px-3 py-4 text-center text-xs text-foreground/50">
          Impossible de charger les horaires. Rechargez la page.
        </p>
      ) : (
        <>
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
                {openNow
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

          {timing === 'scheduled' && (
            <Tabs
              value={activeDay ?? days[0]?.date}
              onValueChange={setActiveDay}
            >
              <TabsList className="w-full max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {days.map((d) => (
                  <TabsTrigger
                    key={d.date}
                    value={d.date}
                    className="flex-none shrink-0"
                  >
                    {dayLabel(d.date, today)}
                  </TabsTrigger>
                ))}
              </TabsList>

              {days.map((d) => (
                <TabsContent key={d.date} value={d.date}>
                  <DaySlots
                    day={d}
                    slots={slotsByDay.get(d.date) ?? []}
                    selected={value}
                    onSelect={onChange}
                  />
                </TabsContent>
              ))}
            </Tabs>
          )}
        </>
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

  // Sélection affichée seulement si elle appartient à ce jour.
  const selectedKey =
    selected && slots.some((s) => s.toISOString() === selected)
      ? selected
      : null;

  const sections = PERIOD_ORDER.map((period) => ({
    period,
    slots: slots.filter((s) => periodOf(s) === period),
  })).filter((s) => s.slots.length > 0);

  return (
    <div className="flex flex-col gap-2 pt-2">
      <p className="text-xs text-foreground/50">
        Ouvert&nbsp;: {formatRanges(day.ranges)}
      </p>
      <Select
        aria-label="Heure de retrait"
        label="Heure de retrait"
        placeholder="Choisir une heure"
        size="sm"
        selectedKeys={selectedKey ? [selectedKey] : []}
        onSelectionChange={(keys) => {
          const k = Array.from(keys)[0];
          if (typeof k === 'string') onSelect(k);
        }}
      >
        {sections.map(({ period, slots: inPeriod }) => (
          <SelectSection key={period} title={PERIOD_LABELS[period]}>
            {inPeriod.map((slot) => {
              const iso = slot.toISOString();
              return <SelectItem key={iso}>{formatAbidjanTime(slot)}</SelectItem>;
            })}
          </SelectSection>
        ))}
      </Select>
    </div>
  );
}
