'use client';

import { Button } from '@/components/ui/button';
import { WEEKDAY_LABELS } from '@/lib/pickup-settings';

// Ordre d'affichage Lun→Dim (0=dimanche…6=samedi, même convention que
// `Product.availableDays`/`ProductSchedule.days`).
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export function WeekdayToggle({
  days,
  onChange,
  disabled,
}: {
  days: number[];
  onChange: (days: number[]) => void;
  disabled?: boolean;
}) {
  function toggle(day: number) {
    onChange(
      days.includes(day)
        ? days.filter((d) => d !== day)
        : [...days, day].sort((a, b) => a - b)
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {WEEKDAY_ORDER.map((day) => (
        <Button
          key={day}
          type="button"
          variant={days.includes(day) ? 'default' : 'outline'}
          size="sm"
          disabled={disabled}
          onClick={() => toggle(day)}
        >
          {WEEKDAY_LABELS[String(day)].slice(0, 3)}
        </Button>
      ))}
    </div>
  );
}
