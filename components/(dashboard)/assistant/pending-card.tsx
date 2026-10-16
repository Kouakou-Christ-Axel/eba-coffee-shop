'use client';

import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PendingAction } from '@/lib/ai/assistant/types';

function format(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** Carte de confirmation : aucune écriture n'a lieu avant le clic. */
export function PendingCard({
  actions,
  busy,
  onDecide,
}: {
  actions: PendingAction[];
  busy: boolean;
  onDecide: (decision: 'approve' | 'reject') => void;
}) {
  // L'identifiant de brouillon n'a aucun sens pour l'utilisateur : le détail
  // est dans le tableau récapitulatif affiché juste au-dessus.
  // `id` masqué seulement quand le libellé lisible le remplace.
  const entries = (a: PendingAction) =>
    a.args && typeof a.args === 'object'
      ? Object.entries(a.args).filter(
          ([k]) => k !== 'draftId' && !(k === 'id' && a.label)
        )
      : [];

  return (
    <div className="rounded-xl border border-secondary bg-secondary/10 p-3">
      <p className="mb-2 text-sm font-medium">
        {actions.length > 1
          ? `${actions.length} actions à confirmer`
          : 'Action à confirmer'}
      </p>
      <div className="flex flex-col gap-3">
        {actions.map((a) => (
          <div key={a.id}>
            <p className="text-sm font-semibold">{a.title}</p>
            {a.label && <p className="text-sm">{a.label}</p>}
            <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
              {entries(a).map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="break-words">{format(v)}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" disabled={busy} onClick={() => onDecide('approve')}>
          <Check /> Confirmer
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => onDecide('reject')}
        >
          <X /> Refuser
        </Button>
      </div>
    </div>
  );
}
