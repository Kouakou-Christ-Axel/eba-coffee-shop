'use client';

// components/(public)/carte/_components/slot-picker.tsx
//
// Sélecteur de créneau de retrait. Charge les créneaux disponibles depuis
// `/api/pickup-slots`, les groupe par jour puis par période de la journée
// (matin / midi / après-midi / soir), et affiche un Tabs HeroUI pour la
// navigation entre jours.
//
// La durée d'un créneau (`SLOT_DURATION_MINUTES`) est sourcée depuis
// `config/constants.ts` ; elle n'est pas utilisée pour le calcul d'affichage
// mais reste exposée pour cohérence sémantique (l'API renvoie déjà les ISO
// strings espacés de cette durée).

import { useEffect, useMemo, useState } from 'react';
import { Clock } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ABIDJAN_TZ, formatAbidjanTime } from '@/lib/timezone';

type SlotPickerProps = {
  value: string | null;
  onChange: (iso: string) => void;
  error?: string;
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

// Jour civil Abidjan (= UTC) : composantes UTC, déterministes côté navigateur.
function dateKey(d: Date): string {
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

function dayLabel(slotDate: Date, today: Date): string {
  const slotK = dateKey(slotDate);
  const todayK = dateKey(today);
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(today.getUTCDate() + 1);
  if (slotK === todayK) return "Aujourd'hui";
  if (slotK === dateKey(tomorrow)) return 'Demain';
  return slotDate.toLocaleDateString('fr-FR', {
    timeZone: ABIDJAN_TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });
}

function periodOf(slot: Date): Period {
  const h = slot.getUTCHours();
  if (h < 12) return 'morning';
  if (h < 14) return 'noon';
  if (h < 18) return 'afternoon';
  return 'evening';
}

function formatHour(slot: Date): string {
  return formatAbidjanTime(slot);
}

type SlotsState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; slots: Date[] };

export function SlotPicker({ value, onChange, error }: SlotPickerProps) {
  const [state, setState] = useState<SlotsState>({ status: 'loading' });
  const [activeDay, setActiveDay] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/pickup-slots')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: { slots: string[] }) => {
        if (cancelled) return;
        setState({
          status: 'ready',
          slots: data.slots.map((s) => new Date(s)),
        });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const today = useMemo(() => {
    // Minuit du jour civil Abidjan (= UTC).
    const n = new Date();
    return new Date(
      Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate())
    );
  }, []);

  const slotsByDay = useMemo(() => {
    const map = new Map<string, Date[]>();
    if (state.status !== 'ready') return map;
    for (const s of state.slots) {
      const k = dateKey(s);
      const arr = map.get(k) ?? [];
      arr.push(s);
      map.set(k, arr);
    }
    return map;
  }, [state]);

  const dayKeys = useMemo(() => Array.from(slotsByDay.keys()), [slotsByDay]);

  if (activeDay === null && dayKeys.length > 0) {
    setActiveDay(dayKeys[0]);
  }

  const selectedDate = value ? new Date(value) : null;
  const selectedLabel = selectedDate
    ? `${dayLabel(selectedDate, today)} à ${formatHour(selectedDate)}`
    : null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex w-full items-baseline justify-between">
        <p className="text-sm font-medium">Créneau de retrait</p>
        {selectedLabel && (
          <span className="flex items-center gap-1 text-xs text-primary">
            <Clock className="h-3 w-3" />
            {selectedLabel}
          </span>
        )}
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      {state.status === 'loading' ? (
        <p className="rounded-md border border-foreground/15 px-3 py-4 text-center text-xs text-foreground/50">
          Chargement des créneaux…
        </p>
      ) : state.status === 'error' ? (
        <p className="rounded-md border border-foreground/15 px-3 py-4 text-center text-xs text-foreground/50">
          Impossible de charger les créneaux. Rechargez la page.
        </p>
      ) : dayKeys.length === 0 ? (
        <p className="rounded-md border border-foreground/15 px-3 py-4 text-center text-xs text-foreground/50">
          Aucun créneau disponible pour le moment.
        </p>
      ) : (
        <Tabs value={activeDay ?? dayKeys[0]} onValueChange={setActiveDay}>
          <TabsList className="w-full max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {dayKeys.map((key) => {
              const sample = slotsByDay.get(key)?.[0];
              return (
                <TabsTrigger key={key} value={key} className="flex-none shrink-0">
                  {sample ? dayLabel(sample, today) : key}
                </TabsTrigger>
              );
            })}
          </TabsList>
          {dayKeys.map((key) => (
            <TabsContent key={key} value={key}>
              <PeriodGroups
                slots={slotsByDay.get(key) ?? []}
                selected={value}
                onSelect={onChange}
              />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}

function PeriodGroups({
  slots,
  selected,
  onSelect,
}: {
  slots: Date[];
  selected: string | null;
  onSelect: (iso: string) => void;
}) {
  if (slots.length === 0) {
    return (
      <p className="py-4 text-center text-xs text-foreground/50">
        Aucun créneau disponible.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4 pt-3">
      {PERIOD_ORDER.map((period) => {
        const inPeriod = slots.filter((s) => periodOf(s) === period);
        if (inPeriod.length === 0) return null;
        return (
          <div key={period} className="flex flex-col gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/50">
              {PERIOD_LABELS[period]}
            </p>
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5 md:grid-cols-6">
              {inPeriod.map((slot) => {
                const iso = slot.toISOString();
                const isSelected = selected === iso;
                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => onSelect(iso)}
                    aria-pressed={isSelected}
                    className={`rounded-md border px-2 py-2 text-sm font-medium transition-all ${
                      isSelected
                        ? 'border-primary bg-primary text-white shadow-sm'
                        : 'border-foreground/15 hover:border-primary/60 hover:bg-primary/5'
                    }`}
                  >
                    {formatHour(slot)}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
