'use client';

import * as React from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { userText, type StoredMessage } from '@/lib/ai/assistant/types';
import { Markdown } from './markdown';

type UserMessage = Extract<StoredMessage, { role: 'user' }>;

function UserBubble({ message }: { message: UserMessage }) {
  const parts = typeof message.content === 'string' ? [] : message.content;
  const text =
    typeof message.content === 'string'
      ? message.content
      : message.content
          .flatMap((p) => (p.type === 'text' ? [p.text] : []))
          .join(' ');
  // Historique rouvert : les fichiers ne sont pas conservés, seule leur mention.
  const placeholder = /\[Fichier joint : /.test(text);

  return (
    <div className="max-w-[88%] self-end rounded-2xl bg-primary px-3 py-2 text-sm text-primary-foreground">
      {parts.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          {parts.map((p, i) =>
            p.type === 'image_url' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={p.image_url.url}
                alt="Fichier joint"
                className="h-20 w-20 rounded-lg object-cover"
              />
            ) : p.type === 'file' ? (
              <span
                key={i}
                className="flex items-center gap-1 rounded-lg bg-primary-foreground/15 px-2 py-1 text-xs"
              >
                <FileText className="size-3.5" /> {p.file.filename}
              </span>
            ) : null
          )}
        </div>
      )}
      {text && (
        <span className="whitespace-pre-wrap">
          {placeholder ? userText(message.content) : text}
        </span>
      )}
    </div>
  );
}

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

  return (
    <div className="flex flex-col gap-3">
      {messages.map((m, i) => {
        if (m.role === 'user') return <UserBubble key={i} message={m} />;
        if (m.role === 'assistant' && m.content?.trim()) {
          return (
            <div
              key={i}
              className={cn(
                'max-w-full self-start rounded-2xl bg-muted px-3 py-2 text-sm'
              )}
            >
              <Markdown>{m.content}</Markdown>
            </div>
          );
        }
        return null;
      })}
      {busy && (
        <div className="flex items-center gap-2 self-start text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Je réfléchis…
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
