// Découverte OAuth 2.0 (RFC 8414) — métadonnées du serveur d'autorisation.
//
// Les clients MCP (Claude web/mobile) résolvent l'« authorization server » à la
// racine de l'origine, alors que les endpoints du plugin Better Auth vivent
// sous `/api/auth/...`. Ce handler expose la métadonnée au chemin attendu
// (`/.well-known/oauth-authorization-server`) en la déléguant au plugin MCP.

import { oAuthDiscoveryMetadata } from 'better-auth/plugins';
import { auth } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = oAuthDiscoveryMetadata(auth);
