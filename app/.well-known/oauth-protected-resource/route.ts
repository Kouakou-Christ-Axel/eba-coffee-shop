// Découverte OAuth 2.0 (RFC 9728) — métadonnées de la ressource protégée.
//
// Indique aux clients MCP quel(s) serveur(s) d'autorisation utiliser pour
// obtenir un jeton d'accès au serveur `/api/mcp`. Exposée à la racine de
// l'origine pour les clients qui la cherchent ici ; la route `/api/mcp` pointe
// aussi vers cette métadonnée via l'en-tête `WWW-Authenticate` d'un 401.

import { oAuthProtectedResourceMetadata } from 'better-auth/plugins';
import { auth } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = oAuthProtectedResourceMetadata(auth);
