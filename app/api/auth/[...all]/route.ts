// Catch-all Better Auth : sessions, OTP email, et endpoints OAuth du plugin
// MCP (`/api/auth/mcp/*` + documents de découverte `/api/auth/.well-known/*`).
//
// Les endpoints OAuth/MCP doivent être joignables depuis un contexte soumis au
// CORS (Claude Desktop, inspecteurs MCP web) : l'URL de métadonnée annoncée
// par le `WWW-Authenticate` du 401 de `/api/mcp` pointe ici, et le SDK MCP
// envoie l'en-tête `MCP-Protocol-Version` qui déclenche un préflight. Sans
// handler `OPTIONS` (405) ni `Access-Control-Allow-Origin`, la découverte
// échoue avant même l'écran de connexion.
//
// Le CORS n'est ouvert QUE sur ces chemins OAuth/découverte (auth par jeton
// Bearer, jamais par cookie : ACAO `*` interdit de toute façon les
// credentials). Les endpoints de session/OTP gardent la posture d'origine.

import { auth } from '@/lib/auth';
import { toNextJsHandler } from 'better-auth/next-js';
import { withCors, corsPreflight } from '@/lib/mcp/cors';

const handlers = toNextJsHandler(auth);

const CORS_PATHS = /^\/api\/auth\/(\.well-known|mcp)\//;

function needsCors(req: Request): boolean {
  return CORS_PATHS.test(new URL(req.url).pathname);
}

export async function GET(req: Request): Promise<Response> {
  const res = await handlers.GET(req);
  return needsCors(req) ? withCors(res, req) : res;
}

export async function POST(req: Request): Promise<Response> {
  const res = await handlers.POST(req);
  return needsCors(req) ? withCors(res, req) : res;
}

export function OPTIONS(req: Request): Response {
  if (needsCors(req)) {
    return corsPreflight(req);
  }
  // Hors périmètre OAuth/MCP : comportement d'avant (pas de handler OPTIONS).
  return new Response(null, { status: 405 });
}
