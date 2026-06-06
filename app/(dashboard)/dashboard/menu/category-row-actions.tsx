'use client';

import { useState, useTransition } from 'react';
import { ChevronUp, ChevronDown, Trash2, Pencil, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  toggleCategoryAvailabilityAction,
  moveCategoryAction,
  deleteCategoryAction,
  updateCategoryAction,
} from './actions';

export function CategoryRowActions({
  id,
  name,
  available,
  isFirst,
  isLast,
}: {
  id: string;
  name: string;
  available: boolean;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(name);

  function startEdit() {
    setEditName(name);
    setIsEditing(true);
  }

  function cancelEdit() {
    setEditName(name);
    setIsEditing(false);
  }

  function confirmRename() {
    if (!editName.trim() || editName.trim() === name) {
      cancelEdit();
      return;
    }
    startTransition(async () => {
      await updateCategoryAction(id, { name: editName.trim() });
      setIsEditing(false);
    });
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') confirmRename();
            if (e.key === 'Escape') cancelEdit();
          }}
          className="h-8 w-40 text-sm"
          autoFocus
          disabled={isPending}
        />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={confirmRename}
          disabled={isPending || !editName.trim()}
          aria-label="Confirmer"
        >
          <Check className="size-4 text-green-600" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={cancelEdit}
          disabled={isPending}
          aria-label="Annuler"
        >
          <X className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={isPending}
        onClick={startEdit}
        aria-label="Renommer"
      >
        <Pencil className="size-4" />
      </Button>
      <Switch
        checked={available}
        disabled={isPending}
        onCheckedChange={() =>
          startTransition(() => toggleCategoryAvailabilityAction(id))
        }
        aria-label="Disponibilité"
      />
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={isPending || isFirst}
        onClick={() => startTransition(() => moveCategoryAction(id, 'up'))}
        aria-label="Monter"
      >
        <ChevronUp className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={isPending || isLast}
        onClick={() => startTransition(() => moveCategoryAction(id, 'down'))}
        aria-label="Descendre"
      >
        <ChevronDown className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={isPending}
        onClick={() => {
          if (
            confirm(
              'Supprimer cette catégorie ? Tous ses produits seront aussi supprimés.'
            )
          ) {
            startTransition(() => deleteCategoryAction(id));
          }
        }}
        aria-label="Supprimer"
      >
        <Trash2 className="size-4 text-destructive" />
      </Button>
    </div>
  );
}
