import { NextResponse } from 'next/server';
import { TOOLSET_NAMES, TOOLSET_TOOL_NAMES } from '@/lib/mcp/tools';

// `?toolset=finance,inventaire` restreint `tools/list`/`tools/call`. Composé
// PAR INTERSECTION avec la restriction de rôle, jamais un remplacement (un
// `tools/list` vide est légitime).

type ToolsetParam = { allowedTools?: Set<string> };

function invalidToolsetResponse(invalidSlug: string): Response {
  return NextResponse.json(
    {
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32602,
        message:
          `Toolset invalide : "${invalidSlug}". Valeurs autorisées : ` +
          `${TOOLSET_NAMES.join(', ')}.`,
      },
    },
    { status: 400 }
  );
}

export function resolveToolsetParam(req: Request): ToolsetParam | Response {
  const raw = new URL(req.url).searchParams.get('toolset');
  if (!raw || raw.trim() === '') return {};

  const slugs = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (slugs.length === 0) return invalidToolsetResponse(raw);

  for (const slug of slugs) {
    if (!(TOOLSET_NAMES as readonly string[]).includes(slug)) {
      return invalidToolsetResponse(slug);
    }
  }

  const allowedTools = new Set<string>();
  for (const slug of slugs as (typeof TOOLSET_NAMES)[number][]) {
    for (const name of TOOLSET_TOOL_NAMES[slug]) allowedTools.add(name);
  }
  return { allowedTools };
}

// `undefined` = aucune restriction (élément neutre de l'intersection).
export function intersectAllowedTools(
  a: Set<string> | undefined,
  b: Set<string> | undefined
): Set<string> | undefined {
  if (!a) return b;
  if (!b) return a;
  const out = new Set<string>();
  for (const name of a) if (b.has(name)) out.add(name);
  return out;
}
