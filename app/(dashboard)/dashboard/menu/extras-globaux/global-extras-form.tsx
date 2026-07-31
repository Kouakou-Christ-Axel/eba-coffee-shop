'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  SupplementsEditor,
  type SupplementGroup,
} from '@/components/(dashboard)/supplements-editor';
import { saveGlobalExtrasAction } from '../actions';

type Props = {
  initialGroups: SupplementGroup[];
};

export function GlobalExtrasForm({ initialGroups }: Props) {
  const router = useRouter();
  const [groups, setGroups] = useState<SupplementGroup[]>(initialGroups);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const payload = groups
          .filter((g) => g.name.trim().length > 0)
          .map((g) => ({
            ...g,
            options: g.options.filter((o) => o.name.trim().length > 0),
          }));
        const result = await saveGlobalExtrasAction(payload);
        if (result?.error) {
          setError(result.error);
          return;
        }
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <SupplementsEditor groups={groups} onChange={setGroups} />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Enregistrement…' : 'Enregistrer'}
      </Button>
    </form>
  );
}
