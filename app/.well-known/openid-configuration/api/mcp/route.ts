// Découverte OpenID Connect (insertion de chemin) — même métadonnée que
// `/.well-known/openid-configuration`, au chemin dérivé de l'URL du serveur
// MCP.
//
// La spécification d'autorisation MCP demande aux clients d'essayer les deux
// emplacements de découverte (RFC 8414 ET OIDC Discovery), y compris avec le
// chemin de la ressource inséré : un client visant `/api/mcp` peut interroger
// `https://<domaine>/.well-known/openid-configuration/api/mcp`. On sert donc la
// même métadonnée ici (déléguée au plugin MCP).

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
