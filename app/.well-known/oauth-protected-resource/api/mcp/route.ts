// Découverte OAuth 2.0 (RFC 9728, insertion de chemin) — métadonnées de la
// ressource protégée, au chemin dérivé de l'URL du serveur MCP.
//
// Un client conforme qui veut accéder à `https://<domaine>/api/mcp` construit
// l'URL des métadonnées en insérant le chemin de la ressource :
// `https://<domaine>/.well-known/oauth-protected-resource/api/mcp`. On sert donc
// la même métadonnée ici (déléguée au plugin MCP), en complément de la version à
// la racine et de celle annoncée via `WWW-Authenticate` sous `/api/auth`.

import { oAuthProtectedResourceMetadata } from 'better-auth/plugins';
import { auth } from '@/lib/auth';
import { corsPreflight } from '@/lib/mcp/cors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = oAuthProtectedResourceMetadata(auth);

// Le SDK MCP envoie l'en-tête `MCP-Protocol-Version` sur les fetchs de
// découverte : depuis un contexte navigateur cela déclenche un préflight CORS,
// qu'il faut accepter (sinon 405 → découverte impossible).
export const OPTIONS = corsPreflight;
