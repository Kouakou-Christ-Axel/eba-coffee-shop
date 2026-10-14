'use client';

import * as React from 'react';
import type {
  AssistantResponse,
  ConversationSummary,
  PendingAction,
  StoredMessage,
} from '@/lib/ai/assistant/types';

type Decisions = Record<string, 'approve' | 'reject'>;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? 'Erreur inattendue');
  return json as T;
}

export function useAssistant() {
  const [messages, setMessages] = React.useState<StoredMessage[]>([]);
  const [pending, setPending] = React.useState<PendingAction[]>([]);
  const [conversationId, setConversationId] = React.useState<string>();
  const [history, setHistory] = React.useState<ConversationSummary[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const refreshHistory = React.useCallback(async () => {
    try {
      const { conversations } = await api<{
        conversations: ConversationSummary[];
      }>('/api/assistant/conversations');
      setHistory(conversations);
    } catch {
      /* l'historique est secondaire : on n'affiche pas d'erreur */
    }
  }, []);

  const send = React.useCallback(
    async (next: StoredMessage[], decisions?: Decisions) => {
      setBusy(true);
      setError(null);
      setMessages(next);
      setPending([]);
      try {
        const res = await api<AssistantResponse>('/api/assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: next, conversationId, decisions }),
        });
        setMessages(res.messages);
        setPending(res.pending);
        setConversationId(res.conversationId);
        void refreshHistory();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur inattendue');
      } finally {
        setBusy(false);
      }
    },
    [conversationId, refreshHistory]
  );

  const ask = (text: string) =>
    send([...messages, { role: 'user', content: text }]);

  const decide = (decisions: Decisions) => send(messages, decisions);

  const reset = () => {
    setMessages([]);
    setPending([]);
    setConversationId(undefined);
    setError(null);
  };

  const open = async (id: string) => {
    setError(null);
    try {
      const c = await api<{ id: string; messages: StoredMessage[] }>(
        `/api/assistant/conversations/${id}`
      );
      setMessages(c.messages);
      setPending([]);
      setConversationId(c.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inattendue');
    }
  };

  const remove = async (id: string) => {
    await api(`/api/assistant/conversations/${id}`, { method: 'DELETE' });
    if (id === conversationId) reset();
    void refreshHistory();
  };

  return {
    messages,
    pending,
    history,
    conversationId,
    busy,
    error,
    ask,
    decide,
    reset,
    open,
    remove,
    refreshHistory,
  };
}
