'use client';

import { MediaImage as Image } from '@/components/ui/media-image';
import { Check, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { PollDetailState } from './use-poll-detail';

export function SuggestionsPanel({ poll }: { poll: PollDetailState }) {
  const { pendingSuggestions, decidedSuggestions, pendingId, moderate } = poll;
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">
        Suggestions de la communauté
        {pendingSuggestions.length > 0 && (
          <Badge className="ml-2">{pendingSuggestions.length}</Badge>
        )}
      </h3>

      {pendingSuggestions.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Aucune suggestion en attente.
        </p>
      )}

      <div className="space-y-2">
        {pendingSuggestions.map((s) => (
          <div
            key={s.id}
            className="flex items-center gap-3 rounded-md border p-3"
          >
            {s.imageUrl && (
              <Image
                src={s.imageUrl}
                alt={s.label}
                width={48}
                height={48}
                className="size-12 shrink-0 rounded-md object-cover"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{s.label}</p>
              {s.description && (
                <p className="text-xs text-muted-foreground">{s.description}</p>
              )}
              {(s.submitterName || s.submitterPhone) && (
                <p className="text-xs text-muted-foreground">
                  Proposé par {s.submitterName ?? 'un client'}
                  {s.submitterPhone ? ` (${s.submitterPhone})` : ''}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => moderate(s, 'approve')}
                disabled={pendingId === s.id}
                aria-label="Approuver"
              >
                <Check className="h-4 w-4 text-primary" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => moderate(s, 'reject')}
                disabled={pendingId === s.id}
                aria-label="Rejeter"
              >
                <X className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {decidedSuggestions.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">
            Historique ({decidedSuggestions.length})
          </summary>
          <div className="mt-2 space-y-2">
            {decidedSuggestions.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-md border p-2 text-xs"
              >
                <span>{s.label}</span>
                <Badge
                  variant={s.status === 'APPROVED' ? 'default' : 'destructive'}
                >
                  {s.status === 'APPROVED' ? 'Approuvée' : 'Rejetée'}
                </Badge>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
