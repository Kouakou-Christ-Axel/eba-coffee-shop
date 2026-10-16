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

// Fichiers joints (photo de ticket, facture PDF) : data URLs base64, compressées
// côté client. Jamais persistés en base (cf. `stripAttachments`).
export const MAX_ATTACHMENTS = 5;
const MAX_DATA_URL = 6_000_000;

const contentPartSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string().max(MAX_CONTENT) }),
  z.object({
    type: z.literal('image_url'),
    image_url: z.object({
      url: z
        .string()
        .max(MAX_DATA_URL)
        .regex(/^data:image\/(jpeg|png|webp);base64,/),
    }),
  }),
  z.object({
    type: z.literal('file'),
    file: z.object({
      filename: z.string().min(1).max(200),
      file_data: z
        .string()
        .max(MAX_DATA_URL)
        .regex(/^data:application\/pdf;base64,/),
    }),
  }),
]);

export const chatMessageSchema = z.discriminatedUnion('role', [
  z.object({
    role: z.literal('user'),
    content: z.union([
      z.string().max(MAX_CONTENT),
      z
        .array(contentPartSchema)
        .min(1)
        .max(MAX_ATTACHMENTS + 1),
    ]),
  }),
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
  /** Cible lisible de l'action (ex. « Produit : Chou à la crème »), si résolue. */
  label?: string;
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

type UserContent = Extract<StoredMessage, { role: 'user' }>['content'];

/** Texte lisible d'un message utilisateur (pièces jointes = leur nom). */
export function userText(content: UserContent): string {
  if (typeof content === 'string') return content;
  return content
    .map((p) =>
      p.type === 'text'
        ? p.text
        : `[Fichier joint : ${p.type === 'file' ? p.file.filename : 'image'}]`
    )
    .join(' ');
}

/** Remplace les fichiers par une mention texte avant persistance en base. */
export function stripAttachments(messages: StoredMessage[]): StoredMessage[] {
  return messages.map((m) =>
    m.role === 'user' && typeof m.content !== 'string'
      ? { role: 'user', content: userText(m.content) }
      : m
  );
}
