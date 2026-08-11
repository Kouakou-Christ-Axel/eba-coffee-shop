'use client';

import { useState, useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  ScheduleField,
  type ScheduleOption,
} from '@/components/(dashboard)/schedule-field';
import { useUndoToast } from '@/lib/hooks/use-undo-toast';
import { createCategoryAction } from './actions';
import { ADVANCE_ORDER_DAYS_MAX } from '@/config/constants';

export function CategoryForm({ schedules }: { schedules: ScheduleOption[] }) {
  const { pushToast } = useUndoToast();
  const [name, setName] = useState('');
  const [scheduleId, setScheduleId] = useState<string | null>(null);
  const [advanceOrderDays, setAdvanceOrderDays] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const created = name.trim();
      const result = await createCategoryAction({
        name,
        scheduleId,
        advanceOrderDays,
      });
      if (!result.ok) {
        setError(result.error);
        pushToast(result.error, 'error');
        return;
      }
      setName('');
      setScheduleId(null);
      setAdvanceOrderDays(null);
      pushToast(`Catégorie « ${created} » créée`);
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
      <div className="space-y-1">
        <Input
          type="number"
          min={1}
          max={ADVANCE_ORDER_DAYS_MAX}
          step={1}
          placeholder="Commande à l'avance (jours, optionnel)"
          value={advanceOrderDays ?? ''}
          onChange={(e) =>
            setAdvanceOrderDays(
              e.target.value === '' ? null : Number(e.target.value)
            )
          }
          disabled={isPending}
        />
        <p className="text-xs text-muted-foreground">
          Délai minimum entre la commande et le retrait pour tout produit de
          cette catégorie. Vide = pas de contrainte.
        </p>
      </div>
    </form>
  );
}
