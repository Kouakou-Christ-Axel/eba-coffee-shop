// Assistant IA du dashboard (OpenRouter). Doc : lib/ai/assistant/run.ts.
// Réservé aux rôles du serveur MCP (ADMIN, MANAGER, COMPTABLE, ANALYSTE) ; les
// outils exposés sont filtrés par rôle (lib/ai/assistant/tools.ts).

import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth-helpers';
import { openRouterConfig } from '@/lib/ai/config';
import { OpenRouterError } from '@/lib/ai/openrouter';
import { runAssistant } from '@/lib/ai/assistant/run';
import { canUseAssistant } from '@/lib/ai/assistant/tools';
import { saveConversation } from '@/lib/ai/assistant/conversations';
import { assistantRequestSchema } from '@/lib/ai/assistant/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request): Promise<Response> {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: 'Non connecté' }, { status: 401 });
  }
  if (session.user.disabledAt || !canUseAssistant(session.user.role)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  const config = openRouterConfig();
  if (!config) {
    return NextResponse.json(
      { error: "L'assistant n'est pas configuré (OPENROUTER_API_KEY)." },
      { status: 503 }
    );
  }

  const parsed = assistantRequestSchema.safeParse(
    await req.json().catch(() => null)
  );
  if (!parsed.success) {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  try {
    const result = await runAssistant(
      config,
      { name: session.user.name, role: session.user.role },
      parsed.data.messages,
      parsed.data.decisions
    );
    const conversationId = await saveConversation(
      session.user.id,
      parsed.data.conversationId,
      result.messages
    );
    return NextResponse.json({ ...result, conversationId });
  } catch (err) {
    console.error('[assistant]', err);
    const message =
      err instanceof OpenRouterError
        ? "Le service d'IA est indisponible, réessaie dans un instant."
        : "L'assistant a rencontré une erreur.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
