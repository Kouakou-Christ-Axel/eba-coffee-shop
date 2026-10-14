// lib/ai/assistant/conversations.ts
//
// Historique des conversations de l'assistant, privé à chaque utilisateur :
// toute requête est filtrée par `userId`.

import prisma from '@/lib/prisma';
import {
  chatMessageSchema,
  MAX_MESSAGES,
  stripAttachments,
  userText,
} from './types';
import type { ConversationSummary, StoredMessage } from './types';
import { z } from 'zod';

const TITLE_MAX = 60;
const LIST_LIMIT = 50;

export function titleFrom(messages: StoredMessage[]): string {
  const first = messages.find((m) => m.role === 'user');
  const text = (first ? userText(first.content) : 'Nouvelle conversation')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > TITLE_MAX ? `${text.slice(0, TITLE_MAX - 1)}…` : text;
}

export async function listConversations(
  userId: string
): Promise<ConversationSummary[]> {
  const rows = await prisma.assistantConversation.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    take: LIST_LIMIT,
    select: { id: true, title: true, updatedAt: true },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function getConversation(userId: string, id: string) {
  const row = await prisma.assistantConversation.findFirst({
    where: { id, userId },
  });
  if (!row) return null;
  const messages = z
    .array(chatMessageSchema)
    .max(MAX_MESSAGES)
    .safeParse(row.messages);
  return {
    id: row.id,
    title: row.title,
    messages: messages.success ? messages.data : [],
  };
}

/** Crée ou met à jour ; renvoie l'id (nouveau si `id` est inconnu / d'un autre). */
export async function saveConversation(
  userId: string,
  id: string | undefined,
  rawMessages: StoredMessage[]
): Promise<string> {
  const messages = stripAttachments(rawMessages);
  if (id) {
    const res = await prisma.assistantConversation.updateMany({
      where: { id, userId },
      data: { messages },
    });
    if (res.count > 0) return id;
  }
  const created = await prisma.assistantConversation.create({
    data: { userId, title: titleFrom(messages), messages },
    select: { id: true },
  });
  return created.id;
}

export async function deleteConversation(
  userId: string,
  id: string
): Promise<boolean> {
  const res = await prisma.assistantConversation.deleteMany({
    where: { id, userId },
  });
  return res.count > 0;
}
