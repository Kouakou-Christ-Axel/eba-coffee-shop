'use client';

import { MessageSquare, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatAbidjanDateTime } from '@/lib/timezone';
import type { ConversationSummary } from '@/lib/ai/assistant/types';

export function HistoryList({
  items,
  activeId,
  onOpen,
  onDelete,
}: {
  items: ConversationSummary[];
  activeId?: string;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Aucune conversation pour le moment.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-1">
      {items.map((c) => (
        <li
          key={c.id}
          className={`flex items-center gap-1 rounded-lg ${c.id === activeId ? 'bg-muted' : ''}`}
        >
          <button
            type="button"
            onClick={() => onOpen(c.id)}
            className="flex min-h-11 min-w-0 flex-1 items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-muted"
          >
            <MessageSquare className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0">
              <span className="block truncate text-sm">{c.title}</span>
              <span className="block text-xs text-muted-foreground">
                {formatAbidjanDateTime(c.updatedAt)}
              </span>
            </span>
          </button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Supprimer la conversation"
            onClick={() => onDelete(c.id)}
          >
            <Trash2 />
          </Button>
        </li>
      ))}
    </ul>
  );
}
