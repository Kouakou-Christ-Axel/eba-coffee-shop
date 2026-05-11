'use client';

import { useState, useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { createCategoryAction } from './actions';

export function CategoryForm() {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await createCategoryAction({ name });
        setName('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2">
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
    </form>
  );
}
