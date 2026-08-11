'use client';

// Création d'une catégorie. Le formulaire est replié par défaut : il n'est
// utilisé qu'occasionnellement, alors que la liste des catégories (l'objet
// principal de la page) était repoussée sous la ligne de flottaison.

import { useState, useTransition } from 'react';
import { Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  ScheduleField,
  type ScheduleOption,
} from '@/components/(dashboard)/schedule-field';
import { createCategoryAction } from './actions';
import { ADVANCE_ORDER_DAYS_MAX } from '@/config/constants';

export function CategoryForm({ schedules }: { schedules: ScheduleOption[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [scheduleId, setScheduleId] = useState<string | null>(null);
  const [advanceOrderDays, setAdvanceOrderDays] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setName('');
    setScheduleId(null);
    setAdvanceOrderDays(null);
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await createCategoryAction({ name, scheduleId, advanceOrderDays });
        reset();
        setIsOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur');
      }
    });
  }

  if (!isOpen) {
    return (
      <Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
        <Plus className="mr-1 size-4" />
        Nouvelle catégorie
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Nouvelle catégorie</h2>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            reset();
            setIsOpen(false);
          }}
          disabled={isPending}
          aria-label="Fermer le formulaire"
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <Label htmlFor="new-category-name">Nom</Label>
          <Input
            id="new-category-name"
            placeholder="Ex. Pâtisseries"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isPending}
            autoFocus
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
        <Label htmlFor="new-category-advance">
          Commande à l’avance (jours, optionnel)
        </Label>
        <Input
          id="new-category-advance"
          type="number"
          min={1}
          max={ADVANCE_ORDER_DAYS_MAX}
          step={1}
          placeholder="Vide = pas de contrainte"
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
          cette catégorie.
        </p>
      </div>
    </form>
  );
}
