// lib/mcp/format.ts
//
// Mise en forme « économe en tokens » des échanges MCP : catalogue allégé,
// réponses compactes, erreurs de validation lisibles par un petit modèle.

import { z } from 'zod';
import type { McpTool } from '@/lib/mcp/tools';

// Retire du JSON Schema ce que le serveur revalide de toute façon et qui ne
// guide pas le modèle : `$schema`, `additionalProperties`.
function slimSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(slimSchema);
  if (!node || typeof node !== 'object') return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === '$schema' || key === 'additionalProperties') continue;
    out[key] = slimSchema(value);
  }
  return out;
}

/** Sérialisation d'un outil pour `tools/list` (sans doublon de `title`). */
export function serializeTool(tool: McpTool) {
  return {
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: slimSchema(z.toJSONSchema(tool.inputSchema, { io: 'input' })),
    annotations: {
      readOnlyHint: tool.readOnly,
      destructiveHint: tool.name.startsWith('delete_'),
      idempotentHint: tool.readOnly,
      openWorldHint: false,
    },
  };
}

/** Une ligne par champ fautif : `champ : message`. */
export function formatZodError(error: z.ZodError): string {
  const lines = error.issues.map((issue) => {
    const path = issue.path.join('.');
    return path ? `- ${path} : ${issue.message}` : `- ${issue.message}`;
  });
  return `Arguments invalides, corrige et réessaie :\n${lines.join('\n')}`;
}

/** JSON compact (pas d'indentation) : `undefined`/`null` → « OK ». */
export function stringifyResult(data: unknown): string {
  if (data === undefined || data === null) return 'OK';
  return JSON.stringify(data);
}
