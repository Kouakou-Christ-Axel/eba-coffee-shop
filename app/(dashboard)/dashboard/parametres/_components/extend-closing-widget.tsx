'use client';

import { useState, useTransition } from 'react';
import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getRangesForDay, type PickupSettings } from '@/lib/pickup-settings';
import { extendTodayClosing } from '../actions';

const QUICK_OPTIONS = [
  { label: '+1h', minutes: 60 },
  { label: '+1h30', minutes: 90 },
  { label: '+2h', minutes: 120 },
];

type Props = {
  settings: PickupSettings;
  onExtended: (settings: PickupSettings) => void;
};

export function ExtendClosingWidget({ settings, onExtended }: Props) {
  const [isPending, startTransition] = useTransition();
  const [customMinutes, setCustomMinutes] = useState('');
  const [feedback, setFeedback] = useState<{
    kind: 'success' | 'error';
    msg: string;
  } | null>(null);

  const todayRanges = getRangesForDay(new Date(), settings);
  const closingTime =
    todayRanges.length > 0
      ? todayRanges.reduce((max, r) => (r.end > max ? r.end : max), '00:00')
      : null;

  function extend(minutes: number) {
    if (!Number.isInteger(minutes) || minutes <= 0) return;
    setFeedback(null);
    startTransition(async () => {
      const result = await extendTodayClosing(minutes);
      if (result.ok) {
        onExtended(result.settings);
        const newRanges = getRangesForDay(new Date(), result.settings);
        const newEnd = newRanges.reduce(
          (max, r) => (r.end > max ? r.end : max),
          '00:00'
        );
        setFeedback({
          kind: 'success',
          msg: `Fermeture repoussée à ${newEnd}.`,
        });
        setCustomMinutes('');
      } else {
        setFeedback({ kind: 'error', msg: result.error });
      }
    });
  }

  return (
    <section className="space-y-4 rounded-lg border bg-card p-5">
      <div>
        <h2 className="font-semibold">
          Repousser la fermeture aujourd&apos;hui
        </h2>
        <p className="text-xs text-muted-foreground">
          Garde la carte accessible côté client plus longtemps. Revient aux
          horaires normaux dès demain.
        </p>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <Clock className="size-4 text-muted-foreground" />
        {closingTime ? (
          <span>
            Fermeture prévue aujourd&apos;hui : <strong>{closingTime}</strong>
          </span>
        ) : (
          <span className="italic text-muted-foreground">
            Fermé aujourd&apos;hui — rien à repousser.
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {QUICK_OPTIONS.map((opt) => (
          <Button
            key={opt.minutes}
            type="button"
            variant="outline"
            className="h-11 min-w-16"
            disabled={isPending || !closingTime}
            onClick={() => extend(opt.minutes)}
          >
            {opt.label}
          </Button>
        ))}
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            max={720}
            placeholder="min"
            value={customMinutes}
            onChange={(e) => setCustomMinutes(e.target.value)}
            className="h-11 w-20"
            disabled={isPending || !closingTime}
            aria-label="Nombre de minutes personnalisé"
          />
          <Button
            type="button"
            variant="outline"
            className="h-11"
            disabled={isPending || !closingTime || !customMinutes}
            onClick={() => extend(Number(customMinutes))}
          >
            Appliquer
          </Button>
        </div>
      </div>

      {feedback && (
        <p
          className={
            feedback.kind === 'success'
              ? 'text-sm text-green-600'
              : 'text-sm text-red-600'
          }
        >
          {feedback.msg}
        </p>
      )}
    </section>
  );
}
