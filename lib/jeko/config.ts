// lib/jeko/config.ts
//
// Lecture de la config Jèko depuis varlock. Fonction et non constante de
// module : `ENV` n'est peuplée que dans le runtime Next.js (cf. lib/site-url.ts).
// `null` = paiement en ligne inerte (une des quatre variables manque).

import { ENV } from 'varlock/env';
import { ONLINE_FEE_PERCENT_DEFAULT } from '@/config/constants';
import type { JekoConfig } from './client';

export function jekoConfig(): JekoConfig | null {
  const { JEKO_API_KEY, JEKO_API_KEY_ID, JEKO_STORE_ID, JEKO_WEBHOOK_SECRET } =
    ENV;
  if (!JEKO_API_KEY || !JEKO_API_KEY_ID || !JEKO_STORE_ID) return null;
  if (!JEKO_WEBHOOK_SECRET) return null;
  return {
    apiKey: JEKO_API_KEY,
    apiKeyId: JEKO_API_KEY_ID,
    storeId: JEKO_STORE_ID,
    baseUrl: ENV.JEKO_API_BASE_URL || undefined,
  };
}

/** Frais de paiement en ligne facturés au client (en %), réglables par env. */
export function onlineFeePercent(): number {
  return ENV.ONLINE_FEE_PERCENT ?? ONLINE_FEE_PERCENT_DEFAULT;
}

export function jekoWebhookSecret(): string {
  return ENV.JEKO_WEBHOOK_SECRET ?? '';
}
