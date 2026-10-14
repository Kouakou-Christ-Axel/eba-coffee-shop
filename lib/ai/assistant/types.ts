// lib/ai/assistant/types.ts
//
// Contrat client ↔ serveur de l'assistant (schémas Zod partagés).

import { z } from 'zod';

export const MAX_MESSAGES = 40;
const MAX_CONTENT = 20_000;

const toolCallSchema = z.object({
  id: z.string().min(1).max(200),
  type: z.literal('function'),
  function: z.object({
    name: z.string().min(1).max(100),
    arguments: z.string().max(MAX_CONTENT),
  }),
});

export const chatMessageSchema = z.discriminatedUnion('role', [
  z.object({ role: z.literal('user'), content: z.string().max(MAX_CONTENT) }),
  z.object({
    role: z.literal('assistant'),
    content: z.string().max(MAX_CONTENT).nullable(),
    tool_calls: z.array(toolCallSchema).max(10).optional(),
  }),
  z.object({
    role: z.literal('tool'),
    tool_call_id: z.string().min(1).max(200),
    content: z.string().max(MAX_CONTENT),
  }),
]);

export const assistantRequestSchema = z.object({
  /** Historique complet (sans le message système, ajouté côté serveur). */
  messages: z.array(chatMessageSchema).min(1).max(MAX_MESSAGES),
  /** Conversation à mettre à jour ; absente = nouvelle conversation. */
  conversationId: z.string().min(1).max(100).optional(),
  /** Réponse de l'utilisateur aux actions en attente : id d'appel → décision. */
  decisions: z.record(z.string(), z.enum(['approve', 'reject'])).optional(),
});

export type AssistantRequest = z.infer<typeof assistantRequestSchema>;
export type StoredMessage = z.infer<typeof chatMessageSchema>;

export type PendingAction = {
  id: string;
  name: string;
  title: string;
  /** Arguments tels que proposés par le modèle (JSON). */
  args: unknown;
};

export type AssistantResponse = {
  conversationId: string;
  /** Historique mis à jour, à renvoyer tel quel au tour suivant. */
  messages: StoredMessage[];
  /** Actions d'écriture en attente de confirmation (sinon la réponse est finale). */
  pending: PendingAction[];
};

export type ConversationSummary = {
  id: string;
  title: string;
  updatedAt: string;
};
