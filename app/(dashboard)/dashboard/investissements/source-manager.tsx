'use client';

import { useState, useTransition } from 'react';
import { Check, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  createInvestmentSourceAction,
  updateInvestmentSourceAction,
  deleteInvestmentSourceAction,
} from './actions';

type Source = { id: string; name: string; _count: { investments: number } };

export function SourceManager({ sources }: { sources: Source[] }) {
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
      const r = await createInvestmentSourceAction({ name });
      if (!r.ok) setError(r.error);
      else setNewName('');
    });
  }

  function saveEdit(id: string) {
    const name = editName.trim();
    if (!name) return;
    setError(null);
    startTransition(async () => {
      const r = await updateInvestmentSourceAction(id, { name });
      if (!r.ok) setError(r.error);
      else setEditingId(null);
    });
  }

  function remove(id: string) {
    setError(null);
    startTransition(async () => {
      const r = await deleteInvestmentSourceAction(id);
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
          placeholder="Nouvelle source (ex. Prêt bancaire)"
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

      {sources.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucune source pour l’instant.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {sources.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-3 px-3 py-2"
            >
              {editingId === s.id ? (
                <div className="flex flex-1 items-center gap-2">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveEdit(s.id)}
                    className="max-w-xs"
                    autoFocus
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => saveEdit(s.id)}
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
                    {s.name}
                    <Badge variant="outline">{s._count.investments}</Badge>
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setEditingId(s.id);
                        setEditName(s.name);
                      }}
                      aria-label="Renommer"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => remove(s.id)}
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
