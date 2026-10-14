'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StoredMessage } from '@/lib/ai/assistant/types';

/** Seuls les textes sont affichés : appels d'outils et résultats restent internes. */
export function MessageList({
  messages,
  busy,
}: {
  messages: StoredMessage[];
  busy: boolean;
}) {
  const endRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, busy]);

  const visible = messages.filter(
    (m) => (m.role === 'user' || m.role === 'assistant') && m.content?.trim()
  );

  return (
    <div className="flex flex-col gap-3">
      {visible.map((m, i) => (
        <div
          key={i}
          className={cn(
            'max-w-[88%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap',
            m.role === 'user'
              ? 'self-end bg-primary text-primary-foreground'
              : 'self-start bg-muted'
          )}
        >
          {m.content}
        </div>
      ))}
      {busy && (
        <div className="flex items-center gap-2 self-start text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Je réfléchis…
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
