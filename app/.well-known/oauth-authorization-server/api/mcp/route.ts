// Découverte OAuth 2.0 (RFC 8414, insertion de chemin) — métadonnées du
// serveur d'autorisation, au chemin dérivé de l'URL du serveur MCP.
//
// Certains clients MCP (ChatGPT notamment) construisent l'URL de découverte du
// serveur d'autorisation en insérant le chemin de la ressource :
// `https://<domaine>/.well-known/oauth-authorization-server/api/mcp`. On sert
// donc la même métadonnée ici (déléguée au plugin MCP), en complément de la
// version à la racine de l'origine.

import { oAuthDiscoveryMetadata } from 'better-auth/plugins';
import { auth } from '@/lib/auth';
import { corsPreflight } from '@/lib/mcp/cors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = oAuthDiscoveryMetadata(auth);

// Le SDK MCP envoie l'en-tête `MCP-Protocol-Version` sur les fetchs de
// découverte : depuis un contexte navigateur cela déclenche un préflight CORS,
// qu'il faut accepter (sinon 405 → découverte impossible).
export const OPTIONS = corsPreflight;
