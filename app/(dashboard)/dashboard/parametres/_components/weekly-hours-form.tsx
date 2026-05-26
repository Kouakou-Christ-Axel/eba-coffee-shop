'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { WEEKDAY_LABELS, type TimeRange } from '@/lib/pickup-settings';

const WEEKDAY_ORDER = ['1', '2', '3', '4', '5', '6', '0'] as const;

type Props = {
  weeklyHours: Record<string, TimeRange[]>;
  onChange: (weekday: string, ranges: TimeRange[]) => void;
};

export function WeeklyHoursForm({ weeklyHours, onChange }: Props) {
  function addRange(weekday: string) {
    const current = weeklyHours[weekday] ?? [];
    onChange(weekday, [...current, { start: '08:00', end: '20:00' }]);
  }

  function removeRange(weekday: string, idx: number) {
    const current = weeklyHours[weekday] ?? [];
    onChange(
      weekday,
      current.filter((_, i) => i !== idx)
    );
  }

  function updateRange(
    weekday: string,
    idx: number,
    field: 'start' | 'end',
    value: string
  ) {
    const current = weeklyHours[weekday] ?? [];
    onChange(
      weekday,
      current.map((r, i) => (i === idx ? { ...r, [field]: value } : r))
    );
  }

  return (
    <section className="space-y-4 rounded-lg border bg-card p-5">
      <div>
        <h2 className="font-semibold">Horaires hebdomadaires</h2>
        <p className="text-xs text-muted-foreground">
          Plusieurs plages possibles par jour. Aucune plage = jour fermé.
        </p>
      </div>
      <div className="space-y-3">
        {WEEKDAY_ORDER.map((weekday) => {
          const ranges = weeklyHours[weekday] ?? [];
          return (
            <div
              key={weekday}
              className="flex flex-col gap-2 rounded-md border bg-background p-3 md:flex-row md:items-start"
            >
              <div className="w-full font-medium md:w-24 md:pt-1.5">
                {WEEKDAY_LABELS[weekday]}
              </div>
              <div className="flex-1 space-y-2">
                {ranges.length === 0 && (
                  <p className="text-xs italic text-muted-foreground">Fermé</p>
                )}
                {ranges.map((range, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={range.start}
                      onChange={(e) =>
                        updateRange(weekday, idx, 'start', e.target.value)
                      }
                      className="w-28"
                    />
                    <span className="text-muted-foreground">→</span>
                    <Input
                      type="time"
                      value={range.end}
                      onChange={(e) =>
                        updateRange(weekday, idx, 'end', e.target.value)
                      }
                      className="w-28"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeRange(weekday, idx)}
                      aria-label="Retirer cette plage"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addRange(weekday)}
                >
                  <Plus className="size-3" />
                  Ajouter une plage
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
