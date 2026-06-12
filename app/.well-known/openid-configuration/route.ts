// Découverte OpenID Connect (`/.well-known/openid-configuration`).
//
// La spécification d'autorisation MCP demande aux clients d'essayer **les deux**
// emplacements de découverte du serveur d'autorisation :
// `/.well-known/oauth-authorization-server` (RFC 8414) ET
// `/.well-known/openid-configuration` (OIDC Discovery). Le plugin MCP de Better
// Auth ne publie que le premier ; comme notre métadonnée a une forme OIDC
// (`id_token`, `userinfo_endpoint`, `claims_supported`…), un client comme Claude
// peut privilégier l'OIDC. On sert donc la même métadonnée ici (issuer +
// endpoints sous `/api/auth/mcp/*`), déléguée au plugin.

import { oAuthDiscoveryMetadata } from 'better-auth/plugins';
import { auth } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = oAuthDiscoveryMetadata(auth);
