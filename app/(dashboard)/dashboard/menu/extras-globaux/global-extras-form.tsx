'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  SupplementsEditor,
  type SupplementGroup,
} from '@/components/(dashboard)/supplements-editor';
import { useUndoToast } from '@/lib/hooks/use-undo-toast';
import { saveGlobalExtrasAction } from '../actions';

type Props = {
  initialGroups: SupplementGroup[];
};

export function GlobalExtrasForm({ initialGroups }: Props) {
  const router = useRouter();
  const { pushToast } = useUndoToast();
  const [groups, setGroups] = useState<SupplementGroup[]>(initialGroups);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const payload = groups
        .filter((g) => g.name.trim().length > 0)
        .map((g) => ({
          ...g,
          options: g.options.filter((o) => o.name.trim().length > 0),
        }));
      const result = await saveGlobalExtrasAction(payload);
      if (!result.ok) {
        setError(result.error);
        pushToast(result.error, 'error');
        return;
      }
      router.refresh();
      pushToast('Extras globaux enregistrés');
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
