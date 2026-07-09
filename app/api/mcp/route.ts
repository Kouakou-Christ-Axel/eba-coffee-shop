// app/api/mcp/route.ts
//
// Serveur MCP (Model Context Protocol) distant — transport « Streamable HTTP ».
// Expose l'administration de l'app (menu, stats, dépenses, caisse, fidélité…) à
// un client MCP comme Claude.
//
// Deux façons de s'authentifier, dans cet ordre :
//
//   1. Jeton statique `MCP_API_KEY` en `Authorization: Bearer <token>`
//      (comparaison à temps constant). Pratique pour un client « machine » qui
//      gère ses en-têtes (Claude Code CLI, Claude Desktop, curl). Optionnel.
//
//   2. OAuth 2.0 (plugin MCP de Better Auth). Le client (Claude web/mobile) ne
//      sait pas coller un en-tête Bearer : il suit le flux OAuth, l'utilisateur
//      se connecte avec SON compte, et un jeton d'accès lui est délivré. On
//      n'autorise que les comptes ADMIN, MANAGER ou COMPTABLE — chaque
//      collaborateur a son propre accès, traçable et révocable. COMPTABLE est
//      restreint aux outils finance (dépenses, investissements,
//      régularisations, clôture, stats — cf. `FINANCE_TOOL_NAMES`).
//
// Le dispatch JSON-RPC vit dans `lib/mcp/handler.ts` ; cette route ne gère que
// le transport HTTP (auth, parsing, réponse, CORS) et l'invalidation du cache.

import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { timingSafeEqual } from 'node:crypto';
import { withMcpAuth } from 'better-auth/plugins';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { handleRpc } from '@/lib/mcp/handler';
import { FINANCE_TOOL_NAMES } from '@/lib/mcp/tools';
import type { UserRole } from '@/generated/prisma/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ─── CORS ─────────────────────────────────────────────────────────────────
//
// Les clients MCP web (claude.ai, inspecteurs, playgrounds) appellent l'endpoint
// depuis un navigateur : il faut un préflight CORS qui autorise TOUS les en-têtes
// envoyés par le client. Plutôt qu'une liste figée (qui omettait par ex.
// `MCP-Protocol-Version` → préflight rejeté → « Problème de connexion »), on
// **reflète** les en-têtes demandés. `Authorization` est toujours ajouté
// explicitement : le wildcard ne le couvre jamais. On expose `WWW-Authenticate`
// pour que la découverte OAuth (401 → resource_metadata) marche côté navigateur.

const DEFAULT_ALLOW_HEADERS =
  'Content-Type, Authorization, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID';

function withCors(res: Response, req?: Request): Response {
  const requested = req?.headers.get('access-control-request-headers');
  const allowHeaders = requested
    ? `${requested}, Authorization`
    : DEFAULT_ALLOW_HEADERS;

  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', allowHeaders);
  res.headers.set(
    'Access-Control-Expose-Headers',
    'WWW-Authenticate, Mcp-Session-Id, Mcp-Protocol-Version'
  );
  res.headers.set('Access-Control-Max-Age', '86400');
  return res;
}

// ─── Authentification par jeton statique (optionnelle) ──────────────────────
//
// Retourne `true` UNIQUEMENT si `MCP_API_KEY` est configurée ET correspond au
// Bearer fourni. Sinon `false` → on tente le chemin OAuth (le Bearer présenté
// peut être un jeton d'accès OAuth, pas la clé statique).

function matchesStaticKey(req: Request): boolean {
  const expected = process.env.MCP_API_KEY;
  if (!expected) return false;

  const header = req.headers.get('authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;

  // Comparaison à temps constant. `timingSafeEqual` exige des buffers de même
  // longueur — on encode les deux et on rejette d'abord les longueurs distinctes.
  const a = Buffer.from(match[1]);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
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
    revalidatePath('/dashboard/inventaire');
  } catch (err) {
    // En dehors d'un contexte de requête Next, revalidatePath peut échouer.
    // L'écriture en base a déjà eu lieu : on ne fait pas échouer l'appel MCP.
    console.warn('[mcp] revalidateMenu a échoué', err);
  }
}

// ─── Traitement JSON-RPC (commun aux deux chemins d'auth) ───────────────────

async function processRpc(
  req: Request,
  allowedTools?: Set<string>
): Promise<Response> {
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

  const options = { onWriteSuccess: revalidateMenu, allowedTools };

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

// ─── Chemin OAuth : jeton valide + rôle autorisé ────────────────────────────
//
// `withMcpAuth` valide le jeton d'accès OAuth (sinon 401 + `WWW-Authenticate`
// pointant vers la métadonnée de ressource, ce qui amorce la découverte côté
// client). On exige ensuite que l'utilisateur derrière le jeton ait un rôle
// autorisé (ADMIN, MANAGER ou COMPTABLE). `withRoleGuard` enveloppe un
// handler déjà autorisé (POST JSON-RPC ou flux SSE GET) : même logique
// d'auth, deux usages. COMPTABLE reçoit en plus un `allowedTools` qui
// restreint `tools/list`/`tools/call` aux outils finance.

const MCP_ROLES: UserRole[] = ['ADMIN', 'MANAGER', 'COMPTABLE'];

function forbidden(): Response {
  return NextResponse.json(
    {
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32001,
        message: 'Accès refusé : rôle non autorisé pour le serveur MCP',
      },
    },
    { status: 403 }
  );
}

function withRoleGuard(
  handler: (
    req: Request,
    allowedTools?: Set<string>
  ) => Response | Promise<Response>
) {
  return withMcpAuth(auth, async (req, session) => {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { role: true },
    });
    if (!user || !MCP_ROLES.includes(user.role)) return forbidden();
    const allowedTools =
      user.role === 'COMPTABLE' ? FINANCE_TOOL_NAMES : undefined;
    return handler(req, allowedTools);
  });
}

const oauthPostHandler = withRoleGuard(processRpc);
const oauthGetHandler = withRoleGuard(() => sseStream());

// ─── Flux SSE pour GET (transport « Streamable HTTP ») ───────────────────────
//
// Le transport MCP « Streamable HTTP » prévoit que le client ouvre un flux SSE
// via GET pour recevoir d'éventuels messages serveur→client. Notre serveur est
// sans état et ne pousse rien, mais les clients (dont le proxy de Claude) ont
// besoin que ce flux EXISTE : répondre 405 fait échouer la connexion
// (« impossible de se connecter au serveur »). On ouvre donc un flux vide
// maintenu en vie par des commentaires keep-alive.

function sseStream(): Response {
  const encoder = new TextEncoder();
  let keepAlive: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(': open\n\n'));
      keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keep-alive\n\n'));
        } catch {
          // Flux déjà fermé : on ignore.
        }
      }, 25000);
    },
    cancel() {
      if (keepAlive) clearInterval(keepAlive);
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      // Empêche nginx de bufferiser le flux SSE (sinon le client ne voit rien).
      'X-Accel-Buffering': 'no',
    },
  });
}

// ─── POST : messages JSON-RPC ────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  // 1. Clé statique (propriétaire / clients « machine »).
  if (matchesStaticKey(req)) {
    return withCors(await processRpc(req), req);
  }
  // 2. OAuth (administrateurs via Claude web/mobile/desktop).
  return withCors(await oauthPostHandler(req), req);
}

// ─── OPTIONS : préflight CORS ────────────────────────────────────────────────

export function OPTIONS(req: Request): Response {
  return withCors(new NextResponse(null, { status: 204 }), req);
}

// ─── GET : flux SSE serveur→client (Streamable HTTP) ─────────────────────────

export async function GET(req: Request): Promise<Response> {
  // 1. Clé statique.
  if (matchesStaticKey(req)) {
    return withCors(sseStream(), req);
  }
  // 2. OAuth (+ garde ADMIN). Sans jeton valide → 401 + WWW-Authenticate.
  return withCors(await oauthGetHandler(req), req);
}
