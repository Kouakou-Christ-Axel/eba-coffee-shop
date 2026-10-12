'use client';

import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { PollDetailState } from './use-poll-detail';

export function AddOptionForm({ poll }: { poll: PollDetailState }) {
  const {
    newLabel,
    setNewLabel,
    newDescription,
    setNewDescription,
    addOption,
    pending,
  } = poll;
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-md border border-dashed p-3">
      <div className="flex-1 space-y-1.5">
        <Input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Nouvelle option (ex. Croissant amande)"
        />
        <Textarea
          value={newDescription}
          onChange={(e) => setNewDescription(e.target.value)}
          placeholder="Description (optionnel)"
        />
      </div>
      <Button onClick={addOption} disabled={pending}>
        <Plus className="mr-1.5 h-4 w-4" />
        Ajouter
      </Button>
    </div>
  );
}
