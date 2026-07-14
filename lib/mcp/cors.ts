// lib/mcp/cors.ts
//
// CORS partagé pour tout ce qui touche au serveur MCP et à sa découverte
// OAuth : la route `/api/mcp`, les documents `/.well-known/*` à la racine et
// les endpoints du plugin Better Auth (`/api/auth/.well-known/*`,
// `/api/auth/mcp/*`).
//
// Les clients MCP web (claude.ai, inspecteurs, playgrounds) et les clients de
// bureau à rendu navigateur (Claude Desktop) appellent ces endpoints depuis un
// contexte soumis au CORS : il faut un préflight qui autorise TOUS les
// en-têtes envoyés par le client. Plutôt qu'une liste figée (qui omettait par
// ex. `MCP-Protocol-Version` → préflight rejeté → « Problème de connexion »),
// on **reflète** les en-têtes demandés. `Authorization` est toujours ajouté
// explicitement : le wildcard ne le couvre jamais. On expose `WWW-Authenticate`
// pour que la découverte OAuth (401 → resource_metadata) marche côté
// navigateur.

const DEFAULT_ALLOW_HEADERS =
  'Content-Type, Authorization, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID';

export function withCors(res: Response, req?: Request): Response {
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

// Réponse de préflight CORS (204 sans corps). Utilisable directement comme
// handler `OPTIONS` d'une route : `export const OPTIONS = corsPreflight;`.
export function corsPreflight(req: Request): Response {
  return withCors(new Response(null, { status: 204 }), req);
}
