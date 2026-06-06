// app/api/mcp/route.ts
//
// Serveur MCP (Model Context Protocol) distant — transport « Streamable HTTP ».
// Expose la gestion du menu (lecture + écriture) à un client MCP comme Claude.
//
// Sécurité : ce serveur est protégé par un jeton statique (`MCP_API_KEY`) passé
// en `Authorization: Bearer <token>`. Le menu étant administrable en écriture,
// on REFUSE tout accès si la clé n’est pas configurée (503) plutôt que d’ouvrir
// un serveur sans protection. La comparaison du jeton est à temps constant.
//
// Le dispatch JSON-RPC vit dans `lib/mcp/handler.ts` ; cette route ne gère que
// le transport HTTP (auth, parsing, réponse) et l’invalidation du cache.

import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { timingSafeEqual } from 'node:crypto';
import { handleRpc } from '@/lib/mcp/handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ─── Authentification ───────────────────────────────────────────────────────

type AuthResult = { ok: true } | { ok: false; status: number; error: string };

function authenticate(req: Request): AuthResult {
  const expected = process.env.MCP_API_KEY;
  if (!expected) {
    return {
      ok: false,
      status: 503,
      error: 'Serveur MCP désactivé (MCP_API_KEY non configurée)',
    };
  }

  const header = req.headers.get('authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return { ok: false, status: 401, error: 'Jeton Bearer manquant' };
  }

  const provided = match[1];
  // Comparaison à temps constant. `timingSafeEqual` exige des buffers de même
  // longueur — on encode les deux et on rejette d’abord les longueurs distinctes.
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, status: 401, error: 'Jeton invalide' };
  }

  return { ok: true };
}

function unauthorized(status: number, error: string) {
  const res = NextResponse.json({ error }, { status });
  if (status === 401) {
    res.headers.set('WWW-Authenticate', 'Bearer realm="mcp"');
  }
  return res;
}

// ─── Invalidation du cache menu après écriture ──────────────────────────────
//
// Reproduit le comportement des server actions (`dashboard/menu/actions.ts`) :
// après une mutation, on revalide les pages qui consomment le menu.

function revalidateMenu() {
  try {
    revalidatePath('/api/menu');
    revalidatePath('/carte');
    revalidatePath('/');
  } catch (err) {
    // En dehors d’un contexte de requête Next, revalidatePath peut échouer.
    // L’écriture en base a déjà eu lieu : on ne fait pas échouer l’appel MCP.
    console.warn('[mcp] revalidateMenu a échoué', err);
  }
}

// ─── POST : messages JSON-RPC ────────────────────────────────────────────────

export async function POST(req: Request) {
  const auth = authenticate(req);
  if (!auth.ok) return unauthorized(auth.status, auth.error);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error' },
      },
      { status: 400 }
    );
  }

  const options = { onWriteSuccess: revalidateMenu };

  // JSON-RPC 2.0 : on accepte un message unique ou (compat clients anciens) un
  // lot. Les notifications (sans réponse) sont filtrées.
  if (Array.isArray(body)) {
    if (body.length === 0) {
      return NextResponse.json(
        {
          jsonrpc: '2.0',
          id: null,
          error: { code: -32600, message: 'Invalid Request' },
        },
        { status: 400 }
      );
    }
    const responses = (
      await Promise.all(body.map((m) => handleRpc(m, options)))
    ).filter((r) => r !== null);
    if (responses.length === 0) {
      return new NextResponse(null, { status: 202 });
    }
    return NextResponse.json(responses);
  }

  const response = await handleRpc(body, options);
  if (response === null) {
    // Notification : pas de corps de réponse.
    return new NextResponse(null, { status: 202 });
  }
  return NextResponse.json(response);
}

// ─── GET : pas de flux SSE serveur→client (serveur sans état) ────────────────

export async function GET() {
  return new NextResponse('Method Not Allowed', { status: 405 });
}
