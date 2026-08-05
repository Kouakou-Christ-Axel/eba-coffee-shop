'use client';

import { useState, useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  ScheduleField,
  type ScheduleOption,
} from '@/components/(dashboard)/schedule-field';
import { createCategoryAction } from './actions';

export function CategoryForm({ schedules }: { schedules: ScheduleOption[] }) {
  const [name, setName] = useState('');
  const [scheduleId, setScheduleId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await createCategoryAction({ name, scheduleId });
        setName('');
        setScheduleId(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <Input
            placeholder="Nom de la nouvelle catégorie"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isPending}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <Button type="submit" disabled={isPending || name.trim().length === 0}>
          {isPending ? 'Ajout…' : 'Ajouter'}
        </Button>
      </div>
      <ScheduleField
        schedules={schedules}
        scheduleId={scheduleId}
        onChange={setScheduleId}
        label="Planning récurrent (optionnel)"
        helpText="Ex. « menu brunch » disponible le week-end seulement."
      />
    </form>
  );
}
