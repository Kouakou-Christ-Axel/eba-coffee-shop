import { Check } from 'lucide-react';
import { formatAbidjanTime } from '@/lib/timezone';
import { cn } from '@/lib/utils';
import { dayLabel, slotDayKey } from './helpers';

/** Matérialise la pré-sélection : visible et réversible en un geste. */
export function DefaultSlotShortcut({
  defaultSlot,
  value,
  today,
  onChange,
  onSelectDay,
}: {
  defaultSlot: Date;
  value: string | null;
  today: string;
  onChange: (iso: string) => void;
  onSelectDay: (day: string) => void;
}) {
  const selected = value === defaultSlot.toISOString();
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        aria-pressed={selected}
        onClick={() => {
          onChange(defaultSlot.toISOString());
          onSelectDay(slotDayKey(defaultSlot));
        }}
        className={cn(
          'flex w-fit items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-xs font-semibold transition-colors',
          selected
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-foreground/10 text-foreground hover:border-primary/40 hover:bg-primary/5'
        )}
      >
        {selected && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
        {dayLabel(slotDayKey(defaultSlot), today)} à{' '}
        {formatAbidjanTime(defaultSlot)}
      </button>
      <p className="text-xs text-foreground/50">Créneau proposé</p>
    </div>
  );
}
