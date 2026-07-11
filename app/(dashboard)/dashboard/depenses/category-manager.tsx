'use client';

import { useState, useTransition } from 'react';
import { Check, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  createExpenseCategoryAction,
  updateExpenseCategoryAction,
  deleteExpenseCategoryAction,
} from './actions';

export type CategoryRow = {
  id: string;
  name: string;
  nature: 'FIXED' | 'VARIABLE';
  _count: { expenses: number };
};

const selectClass =
  'h-8 rounded-md border border-input bg-transparent px-2 text-xs shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';

export function CategoryManager({ categories }: { categories: CategoryRow[] }) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add() {
    const name = newName.trim();
    if (!name) return;
    setError(null);
    startTransition(async () => {
      const r = await createExpenseCategoryAction({ name });
      if (!r.ok) setError(r.error);
      else setNewName('');
    });
  }

  function saveEdit(id: string) {
    const name = editName.trim();
    if (!name) return;
    setError(null);
    startTransition(async () => {
      const r = await updateExpenseCategoryAction(id, { name });
      if (!r.ok) setError(r.error);
      else setEditingId(null);
    });
  }

  // Fixe (loyer, salaires, abonnements…) ou variable (achats) : alimente le
  // split fixes/variables des statistiques.
  function setNature(id: string, nature: 'FIXED' | 'VARIABLE') {
    setError(null);
    startTransition(async () => {
      const r = await updateExpenseCategoryAction(id, { nature });
      if (!r.ok) setError(r.error);
    });
  }

  function remove(id: string) {
    setError(null);
    startTransition(async () => {
      const r = await deleteExpenseCategoryAction(id);
      if (!r.ok) setError(r.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Nouvelle catégorie (ex. Emballages)"
          className="max-w-xs"
        />
        <Button onClick={add} disabled={pending || !newName.trim()}>
          {pending ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-1.5 h-4 w-4" />
          )}
          Ajouter
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucune catégorie pour l’instant.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {categories.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-3 px-3 py-2"
            >
              {editingId === c.id ? (
                <div className="flex flex-1 items-center gap-2">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveEdit(c.id)}
                    className="max-w-xs"
                    autoFocus
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => saveEdit(c.id)}
                    disabled={pending}
                    aria-label="Valider"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setEditingId(null)}
                    aria-label="Annuler"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <span className="flex items-center gap-2 text-sm">
                    {c.name}
                    <Badge variant="outline">{c._count.expenses}</Badge>
                  </span>
                  <div className="flex items-center gap-1">
                    <select
                      className={selectClass}
                      value={c.nature}
                      onChange={(e) =>
                        setNature(c.id, e.target.value as 'FIXED' | 'VARIABLE')
                      }
                      disabled={pending}
                      aria-label={`Nature de « ${c.name} »`}
                    >
                      <option value="VARIABLE">Variable</option>
                      <option value="FIXED">Fixe</option>
                    </select>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setEditingId(c.id);
                        setEditName(c.name);
                      }}
                      aria-label="Renommer"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => remove(c.id)}
                      disabled={pending}
                      aria-label="Supprimer"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
