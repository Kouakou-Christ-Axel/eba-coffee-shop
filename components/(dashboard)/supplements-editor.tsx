'use client';

// Éditeur de groupes de suppléments, partagé SANS variante par l'onglet « Suppléments » de la fiche produit
// et la page Extras globaux. Rien d'implicite : chaque valeur porte un libellé permanent, « Illimité » est un état choisi.
//
// ⚠ `useUndoToast` exige un `<UndoToastProvider>` : monté dans `app/(dashboard)/dashboard/menu/layout.tsx`.

import { Plus } from 'lucide-react';
import { Reorder } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ConfirmDialog } from '@/components/(dashboard)/confirm-dialog';
import type {
  SupplementGroup,
  SupplementGroupIssues,
  SupplementOption,
} from '@/lib/supplements-form';
import { GroupCard } from './supplements-editor/group-card';
import { useSupplementsEditor } from './supplements-editor/use-supplements-editor';

// Les types vivent dans `lib/supplements-form.ts` ; ré-exportés pour les deux formulaires consommateurs.
export type { SupplementGroup, SupplementOption };

type Props = {
  groups: SupplementGroup[];
  onChange: (groups: SupplementGroup[]) => void;
  /** Erreurs par position de groupe, fournies par le parent APRÈS une tentative d'enregistrement. */
  issues?: ReadonlyMap<number, SupplementGroupIssues>;
};

export function SupplementsEditor({ groups, onChange, issues }: Props) {
  const {
    ui,
    openIds,
    pendingDelete,
    setPendingDelete,
    reduceMotion,
    setOpen,
    addGroup,
    updateGroup,
    removeGroup,
    requestRemoveGroup,
    addOption,
    updateOption,
    removeOption,
    reorderGroups,
  } = useSupplementsEditor({ groups, onChange, issues });

  return (
    <Card>
      <CardHeader className="px-3 sm:px-6">
        <CardTitle className="text-base">Groupes de suppléments</CardTitle>
        <CardDescription>
          Un groupe est une question posée au client (« Choix du lait ») ; ses
          options en sont les réponses.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3 px-3 sm:px-6">
        {ui.length === 0 && (
          <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
            Aucun groupe de suppléments.
          </p>
        )}

        <Reorder.Group
          as="div"
          axis="y"
          values={ui.map((g) => g.uid)}
          onReorder={reorderGroups}
          className="space-y-3"
        >
          {ui.map((group, gi) => (
            <GroupCard
              key={group.uid}
              group={group}
              issues={issues?.get(gi)}
              open={openIds.has(group.uid)}
              reduceMotion={Boolean(reduceMotion)}
              onToggle={(open) => setOpen(group.uid, open)}
              onUpdate={(patch) => updateGroup(group.uid, patch)}
              onRemove={() => requestRemoveGroup(group)}
              onAddOption={() => addOption(group.uid)}
              onUpdateOption={(optionUid, patch) =>
                updateOption(group.uid, optionUid, patch)
              }
              onRemoveOption={(option) => removeOption(group.uid, option)}
              onReorderOptions={(options) =>
                updateGroup(group.uid, { options })
              }
            />
          ))}
        </Reorder.Group>

        <Button
          type="button"
          variant="outline"
          onClick={addGroup}
          className="h-11 w-full sm:h-9 sm:w-auto"
        >
          <Plus className="size-4" /> Ajouter un groupe
        </Button>
      </CardContent>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Supprimer ce groupe ?"
        description={
          pendingDelete
            ? `« ${pendingDelete.name.trim() || 'Nouveau groupe'} » et ses ${pendingDelete.options.length} option(s) seront retirés du formulaire. La suppression deviendra définitive à l’enregistrement.`
            : ''
        }
        confirmLabel="Supprimer"
        destructive
        onConfirm={() => {
          if (pendingDelete) removeGroup(pendingDelete);
        }}
      />
    </Card>
  );
}
