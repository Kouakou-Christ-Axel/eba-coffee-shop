'use client';

// Édition d'une catégorie dans un panneau latéral.
//
// Auparavant le formulaire d'édition était rendu *à l'intérieur* de la cellule
// « Actions » (alignée à droite, ~200 px de large) : la ligne du tableau
// explosait et les champs devenaient inutilisables. Le Sheet donne au
// formulaire la place dont il a besoin, sans déformer la liste.
//
// Le formulaire vit dans un composant séparé, monté seulement quand le panneau
// est ouvert : le brouillon repart donc des valeurs à jour à chaque ouverture,
// sans effet de resynchronisation.

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  ScheduleField,
  type ScheduleOption,
} from '@/components/(dashboard)/schedule-field';
import { updateCategoryAction } from './actions';
import { ADVANCE_ORDER_DAYS_MAX } from '@/config/constants';

type CategoryEditProps = {
  id: string;
  name: string;
  scheduleId: string | null;
  advanceOrderDays: number | null;
  schedules: ScheduleOption[];
};

export function CategoryEditSheet({
  open,
  onOpenChange,
  ...category
}: CategoryEditProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Modifier la catégorie</SheetTitle>
          <SheetDescription>
            Nom affiché sur la carte, planning de disponibilité et délai de
            commande à l’avance.
          </SheetDescription>
        </SheetHeader>
        <CategoryEditForm {...category} onDone={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}

function CategoryEditForm({
  id,
  name,
  scheduleId,
  advanceOrderDays,
  schedules,
  onDone,
}: CategoryEditProps & { onDone: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [editName, setEditName] = useState(name);
  const [editScheduleId, setEditScheduleId] = useState(scheduleId);
  const [editAdvanceOrderDays, setEditAdvanceOrderDays] =
    useState(advanceOrderDays);
  const [error, setError] = useState<string | null>(null);

  const trimmed = editName.trim();
  const isDirty =
    trimmed !== name ||
    editScheduleId !== scheduleId ||
    editAdvanceOrderDays !== advanceOrderDays;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!trimmed) return;
    if (!isDirty) {
      onDone();
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await updateCategoryAction(id, {
          name: trimmed,
          scheduleId: editScheduleId,
          advanceOrderDays: editAdvanceOrderDays,
        });
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur');
      }
    });
  }

  return (
    <>
      <form
        id="category-edit-form"
        onSubmit={handleSubmit}
        className="flex-1 space-y-4 overflow-y-auto px-4"
      >
        <div className="space-y-1.5">
          <Label htmlFor="category-name">Nom</Label>
          <Input
            id="category-name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            disabled={isPending}
            autoFocus
          />
        </div>

        <ScheduleField
          schedules={schedules}
          scheduleId={editScheduleId}
          onChange={setEditScheduleId}
          label="Planning récurrent"
          helpText="Ex. « menu brunch » disponible le week-end seulement."
        />

        <div className="space-y-1.5">
          <Label htmlFor="category-advance">Commande à l’avance (jours)</Label>
          <Input
            id="category-advance"
            type="number"
            min={1}
            max={ADVANCE_ORDER_DAYS_MAX}
            step={1}
            placeholder="Vide = pas de contrainte"
            value={editAdvanceOrderDays ?? ''}
            onChange={(e) =>
              setEditAdvanceOrderDays(
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

        {error && <p className="text-xs text-destructive">{error}</p>}
      </form>

      <SheetFooter>
        <Button
          type="submit"
          form="category-edit-form"
          disabled={isPending || !trimmed || !isDirty}
        >
          {isPending ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
        <Button variant="outline" onClick={onDone} disabled={isPending}>
          Annuler
        </Button>
      </SheetFooter>
    </>
  );
}
