'use client';

import * as React from 'react';
import { History, MessageSquarePlus, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { HistoryList } from './history-list';
import { MessageList } from './message-list';
import { PendingCard } from './pending-card';
import { useAssistant } from './use-assistant';

const SUGGESTIONS = [
  "Ajoute une dépense de 5 000 F de lait aujourd'hui",
  "Quel est le chiffre d'affaires d'hier ?",
  'Quels articles sont en stock bas ?',
];

export default function AssistantPanel({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const a = useAssistant();
  const [text, setText] = React.useState('');
  const [showHistory, setShowHistory] = React.useState(false);

  React.useEffect(() => {
    if (open) void a.refreshHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = (value: string) => {
    const v = value.trim();
    if (!v || a.busy) return;
    setText('');
    setShowHistory(false);
    void a.ask(v);
  };

  const decideAll = (d: 'approve' | 'reject') =>
    a.decide(Object.fromEntries(a.pending.map((p) => [p.id, d])));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full gap-0 sm:max-w-md"
        aria-describedby={undefined}
      >
        <SheetHeader className="border-b pr-12">
          <SheetTitle>Assistant</SheetTitle>
          <SheetDescription className="sr-only">
            Posez une question ou demandez une action.
          </SheetDescription>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                a.reset();
                setShowHistory(false);
              }}
            >
              <MessageSquarePlus /> Nouvelle
            </Button>
            <Button
              size="sm"
              variant={showHistory ? 'secondary' : 'outline'}
              onClick={() => setShowHistory((s) => !s)}
            >
              <History /> Historique
            </Button>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4">
          {showHistory ? (
            <HistoryList
              items={a.history}
              activeId={a.conversationId}
              onOpen={(id) => {
                void a.open(id);
                setShowHistory(false);
              }}
              onDelete={(id) => void a.remove(id)}
            />
          ) : a.messages.length === 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">
                Je peux répondre à vos questions et agir (dépenses, menu,
                stock…). Toute modification vous est d’abord soumise.
              </p>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => submit(s)}
                  className="rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  {s}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <MessageList messages={a.messages} busy={a.busy} />
              {a.pending.length > 0 && (
                <PendingCard
                  actions={a.pending}
                  busy={a.busy}
                  onDecide={decideAll}
                />
              )}
              {a.error && (
                <p role="alert" className="text-sm text-destructive">
                  {a.error}
                </p>
              )}
            </div>
          )}
        </div>

        <form
          className="flex items-end gap-2 border-t p-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit(text);
          }}
        >
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit(text);
              }
            }}
            placeholder="Écrivez votre demande…"
            rows={1}
            className="max-h-32 min-h-11 resize-none"
            disabled={a.pending.length > 0}
          />
          <Button
            type="submit"
            size="icon-lg"
            aria-label="Envoyer"
            disabled={a.busy || !text.trim() || a.pending.length > 0}
          >
            <Send />
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
