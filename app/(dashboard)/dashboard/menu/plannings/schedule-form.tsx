'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { WeekdayToggle } from './weekday-toggle';
import { createProductScheduleAction } from '../actions';

export function ScheduleForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [days, setDays] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createProductScheduleAction({
        name: name.trim(),
        days,
      });
      if (result?.error) {
        setError(result.error);
        return;
      }
      setName('');
      setDays([]);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1">
          <Input
            placeholder="Nom du planning (ex. Jour du chocolat)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isPending}
          />
        </div>
        <Button
          type="submit"
          disabled={isPending || !name.trim() || days.length === 0}
        >
          {isPending ? 'Ajout…' : 'Créer le planning'}
        </Button>
      </div>
      <WeekdayToggle days={days} onChange={setDays} disabled={isPending} />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  );
}
