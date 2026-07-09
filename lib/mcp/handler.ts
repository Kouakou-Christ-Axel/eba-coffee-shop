// lib/mcp/handler.ts
//
// Dispatcher JSON-RPC 2.0 implémentant le sous-ensemble du protocole MCP
// (Model Context Protocol) nécessaire à un serveur « tools-only » sans état :
//
//   • initialize                 → poignée de main + capacités
//   • notifications/initialized  → notification (aucune réponse)
//   • ping                       → keep-alive
//   • tools/list                 → liste des outils + leur JSON Schema
//   • tools/call                 → exécution d’un outil
//
// On implémente le transport « Streamable HTTP » côté route (app/api/mcp). Ce
// module reste agnostique du framework : il prend un message JSON-RPC déjà
// parsé et renvoie la réponse (ou `null` pour une notification). Cela le rend
// testable isolément, sans Request/Response Next.js.

import { z } from 'zod';
import { tools, toolsByName, type McpTool } from '@/lib/mcp/tools';

// Dernière version du protocole que l’on connaît. Si le client en demande une
// autre, on lui renvoie la sienne quand elle nous est connue, sinon la nôtre.
const LATEST_PROTOCOL_VERSION = '2025-06-18';
const SUPPORTED_PROTOCOL_VERSIONS = new Set([
  '2025-06-18',
  '2025-03-26',
  '2024-11-05',
]);

export const SERVER_INFO = {
  name: 'eba-coffee-menu',
  version: '1.0.0',
} as const;

// ─── Types JSON-RPC ───────────────────────────────────────────────────────────

type JsonRpcId = string | number | null;

export type JsonRpcRequest = {
  jsonrpc: '2.0';
  id?: JsonRpcId;
  method: string;
  params?: unknown;
};

export type JsonRpcResponse = {
  jsonrpc: '2.0';
  id: JsonRpcId;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

// Codes d’erreur JSON-RPC standard.
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;

function ok(id: JsonRpcId, result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result };
}

function fail(
  id: JsonRpcId,
  code: number,
  message: string,
  data?: unknown
): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message, data } };
}

// ─── Options ──────────────────────────────────────────────────────────────────

export type HandleOptions = {
  /**
   * Appelé après l’exécution réussie d’un outil en écriture (non `readOnly`).
   * La route s’en sert pour invalider le cache du menu public.
   */
  onWriteSuccess?: (toolName: string) => void;
  /**
   * Restreint les outils visibles/appelables (rôle COMPTABLE : outils finance
   * uniquement, cf. `FINANCE_TOOL_NAMES`). `undefined` = aucune restriction
   * (ADMIN/MANAGER, accès à tous les outils).
   */
  allowedTools?: Set<string>;
};

// ─── Sérialisation d’un outil pour tools/list ──────────────────────────────────

function serializeTool(tool: McpTool) {
  return {
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: z.toJSONSchema(tool.inputSchema, { io: 'input' }),
    annotations: {
      title: tool.title,
      readOnlyHint: tool.readOnly,
      destructiveHint: tool.name.startsWith('delete_'),
      idempotentHint: tool.readOnly,
      openWorldHint: false,
    },
  };
}

// ─── tools/call ────────────────────────────────────────────────────────────────

async function callTool(
  id: JsonRpcId,
  params: unknown,
  options: HandleOptions
): Promise<JsonRpcResponse> {
  const callParams = z
    .object({ name: z.string(), arguments: z.unknown().optional() })
    .safeParse(params);
  if (!callParams.success) {
    return fail(id, INVALID_PARAMS, 'Paramètres tools/call invalides');
  }

  const tool = toolsByName.get(callParams.data.name);
  if (!tool) {
    return fail(id, INVALID_PARAMS, `Outil inconnu : ${callParams.data.name}`);
  }

  if (options.allowedTools && !options.allowedTools.has(tool.name)) {
    return toolError(id, 'Outil non autorisé pour ce rôle.');
  }

  // Validation des arguments via le schéma Zod de l’outil.
  const parsedArgs = tool.inputSchema.safeParse(
    callParams.data.arguments ?? {}
  );
  if (!parsedArgs.success) {
    return toolError(
      id,
      'Arguments invalides : ' +
        JSON.stringify(z.flattenError(parsedArgs.error))
    );
  }

  // Erreurs d’exécution → renvoyées DANS le résultat (`isError: true`), pas
  // comme erreur protocolaire : c’est la convention MCP pour que le modèle
  // puisse voir et corriger l’erreur métier.
  try {
    const data = await tool.handler(parsedArgs.data);
    if (!tool.readOnly) options.onWriteSuccess?.(tool.name);
    return ok(id, {
      content: [{ type: 'text', text: stringify(data) }],
      structuredContent: toStructured(data),
      isError: false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return toolError(id, message);
  }
}

function toolError(id: JsonRpcId, message: string): JsonRpcResponse {
  return ok(id, {
    content: [{ type: 'text', text: message }],
    isError: true,
  });
}

function stringify(data: unknown): string {
  if (data === undefined || data === null) return 'OK';
  return JSON.stringify(data, null, 2);
}

// `structuredContent` doit être un objet JSON. On enveloppe les valeurs non-objet
// (tableaux, primitives, undefined) sous une clé `result`.
function toStructured(data: unknown): Record<string, unknown> {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return { result: data ?? null };
}

// ─── Dispatch principal ─────────────────────────────────────────────────────────

/**
 * Traite un message JSON-RPC. Renvoie la réponse, ou `null` s’il s’agit d’une
 * notification (pas d’`id`) qui n’attend pas de réponse.
 */
export async function handleRpc(
  message: unknown,
  options: HandleOptions = {}
): Promise<JsonRpcResponse | null> {
  if (!message || typeof message !== 'object') {
    return fail(null, INVALID_REQUEST, 'Message JSON-RPC invalide');
  }

  const msg = message as JsonRpcRequest;
  const isNotification = msg.id === undefined;
  const id: JsonRpcId = msg.id ?? null;

  if (msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
    return isNotification
      ? null
      : fail(id, INVALID_REQUEST, 'Message JSON-RPC invalide');
  }

  switch (msg.method) {
    case 'initialize': {
      const requested = (msg.params as { protocolVersion?: string } | undefined)
        ?.protocolVersion;
      const protocolVersion =
        requested && SUPPORTED_PROTOCOL_VERSIONS.has(requested)
          ? requested
          : LATEST_PROTOCOL_VERSION;
      return ok(id, {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions:
          'Serveur de gestion du menu EBA Coffee Shop. Appelle d’abord ' +
          '`get_menu` pour récupérer les identifiants avant toute modification. ' +
          'Les prix sont en francs CFA (entiers).',
      });
    }

    // Notifications du client : on accuse réception sans corps.
    case 'notifications/initialized':
    case 'notifications/cancelled':
      return null;

    case 'ping':
      return ok(id, {});

    case 'tools/list': {
      const visible = options.allowedTools
        ? tools.filter((t) => options.allowedTools!.has(t.name))
        : tools;
      return ok(id, { tools: visible.map(serializeTool) });
    }

    case 'tools/call':
      return callTool(id, msg.params, options);

    default:
      if (isNotification) return null;
      return fail(id, METHOD_NOT_FOUND, `Méthode inconnue : ${msg.method}`);
  }
}
