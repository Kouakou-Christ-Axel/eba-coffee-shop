// lib/ai/assistant/run.ts
//
// Boucle agent : le modèle appelle des outils, les lectures s'exécutent tout de
// suite, TOUTE écriture attend la confirmation explicite de l'utilisateur
// (`pending`). Le client renvoie l'historique + ses `decisions` pour reprendre.
//
// Sécurité : l'historique vient du client, mais chaque appel rejoué repasse par
// `runAssistantTool` (rôle + validation Zod) — un client falsifié n'obtient
// rien de plus que ce que son rôle permet déjà via le dashboard ou le MCP.

import {
  chatCompletion,
  type ChatMessage,
  type OpenRouterConfig,
  type ToolCall,
} from '../openrouter';
import { pendingLabel } from './labels';
import { systemPrompt } from './prompt';
import {
  assistantToolDefinitions,
  isWriteTool,
  runAssistantTool,
  toolTitle,
} from './tools';
import type { AssistantResponse, PendingAction, StoredMessage } from './types';
import type { UserRole } from '@/generated/prisma/client';

const MAX_STEPS = 10;
const REFUSED = "Refusé par l'utilisateur : n'exécute pas cette action.";
const REPEATED =
  "Appel identique déjà effectué : le résultat serait le même. Change d'approche (autre outil, autres arguments) ou pose une question à l'utilisateur.";

type Actor = { name: string | null; role: UserRole };

function parseArgs(raw: string): unknown {
  try {
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return raw;
  }
}

/** Appels du dernier message assistant qui n'ont pas encore de résultat. */
export function unresolvedCalls(messages: StoredMessage[]): ToolCall[] {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === 'assistant') {
      const answered = new Set(
        messages
          .slice(i + 1)
          .flatMap((x) => (x.role === 'tool' ? [x.tool_call_id] : []))
      );
      return (m.tool_calls ?? []).filter((c) => !answered.has(c.id));
    }
  }
  return [];
}

async function executeCalls(
  calls: ToolCall[],
  decisions: Record<string, 'approve' | 'reject'>,
  actor: Actor,
  out: StoredMessage[],
  seen: Set<string>
): Promise<PendingAction[]> {
  const pending: PendingAction[] = [];
  for (const call of calls) {
    const { name, arguments: raw } = call.function;
    if (isWriteTool(name)) {
      const decision = decisions[call.id];
      if (!decision) {
        const args = parseArgs(raw);
        pending.push({
          id: call.id,
          name,
          title: toolTitle(name),
          label: await pendingLabel(args),
          args,
        });
        continue;
      }
      if (decision === 'reject') {
        out.push({ role: 'tool', tool_call_id: call.id, content: REFUSED });
        continue;
      }
    }
    // Anti-boucle : une LECTURE identique (même outil, mêmes arguments) donnerait
    // le même résultat. Les écritures approuvées ne passent pas ici deux fois.
    const key = `${name}:${raw}`;
    if (!isWriteTool(name) && seen.has(key)) {
      out.push({ role: 'tool', tool_call_id: call.id, content: REPEATED });
      continue;
    }
    seen.add(key);
    const result = await runAssistantTool(name, raw, actor.role);
    out.push({
      role: 'tool',
      tool_call_id: call.id,
      content: result.ok ? result.content : `Erreur : ${result.content}`,
    });
  }
  return pending;
}

export async function runAssistant(
  config: OpenRouterConfig,
  actor: Actor,
  history: StoredMessage[],
  decisions: Record<string, 'approve' | 'reject'> = {},
  fetchImpl?: typeof fetch
): Promise<Omit<AssistantResponse, 'conversationId'>> {
  const messages = [...history];
  const toolDefs = assistantToolDefinitions(actor.role);

  // Reprise : traiter d'abord les appels laissés en attente au tour précédent.
  let calls = unresolvedCalls(messages);
  const seen = new Set<string>();

  for (let step = 0; step < MAX_STEPS; step++) {
    if (calls.length > 0) {
      const pending = await executeCalls(
        calls,
        decisions,
        actor,
        messages,
        seen
      );
      if (pending.length > 0) return { messages, pending };
      calls = [];
    }

    const reply = await chatCompletion(
      config,
      {
        messages: [
          {
            role: 'system',
            content: systemPrompt({ name: actor.name, role: actor.role }),
          },
          ...(messages as ChatMessage[]),
        ],
        tools: toolDefs,
      },
      fetchImpl
    );

    messages.push({
      role: 'assistant',
      content: reply.content ?? null,
      ...(reply.tool_calls?.length ? { tool_calls: reply.tool_calls } : {}),
    });
    if (!reply.tool_calls?.length) return { messages, pending: [] };
    calls = reply.tool_calls;
  }

  messages.push({
    role: 'assistant',
    content:
      "Je n'arrive pas à terminer cette demande (trop d'étapes sans résultat). Dites-moi précisément le nom du produit ou de l'élément concerné, ou reformulez.",
  });
  return { messages, pending: [] };
}
