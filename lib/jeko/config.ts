// lib/jeko/config.ts
//
// Lecture de la config Jèko depuis varlock. Fonction et non constante de
// module : `ENV` n'est peuplée que dans le runtime Next.js (cf. lib/site-url.ts).
// `null` = paiement en ligne inerte (une des quatre variables manque).

import { ENV } from 'varlock/env';
import { ONLINE_FEE_PERCENT_DEFAULT } from '@/config/constants';
import {
  DEFAULT_JEKO_ACCOUNT,
  JEKO_ACCOUNTS,
  type JekoAccount,
} from './accounts';
import type { JekoConfig } from './client';

function credentials(account: JekoAccount) {
  return account === 'B'
    ? {
        apiKey: ENV.JEKO_B_API_KEY,
        apiKeyId: ENV.JEKO_B_API_KEY_ID,
        storeId: ENV.JEKO_B_STORE_ID,
        webhookSecret: ENV.JEKO_B_WEBHOOK_SECRET,
      }
    : {
        apiKey: ENV.JEKO_API_KEY,
        apiKeyId: ENV.JEKO_API_KEY_ID,
        storeId: ENV.JEKO_STORE_ID,
        webhookSecret: ENV.JEKO_WEBHOOK_SECRET,
      };
}

/**
 * Config d'un compte (A par défaut). Pour une commande existante, passer
 * `order.jekoAccount` ; le compte actif (`getActiveJekoAccount`) ne sert qu'à
 * créer un paiement.
 */
export function jekoConfig(
  account: JekoAccount = DEFAULT_JEKO_ACCOUNT
): JekoConfig | null {
  const { apiKey, apiKeyId, storeId, webhookSecret } = credentials(account);
  if (!apiKey || !apiKeyId || !storeId) return null;
  if (!webhookSecret) return null;
  return {
    apiKey,
    apiKeyId,
    storeId,
    baseUrl: ENV.JEKO_API_BASE_URL || undefined,
  };
}

/** Comptes dont les quatre variables sont renseignées. */
export function configuredJekoAccounts(): JekoAccount[] {
  return JEKO_ACCOUNTS.filter((a) => jekoConfig(a) !== null);
}

/** Frais de paiement en ligne facturés au client (en %), réglables par env. */
export function onlineFeePercent(): number {
  return ENV.ONLINE_FEE_PERCENT ?? ONLINE_FEE_PERCENT_DEFAULT;
}

export function jekoWebhookSecret(
  account: JekoAccount = DEFAULT_JEKO_ACCOUNT
): string {
  return credentials(account).webhookSecret ?? '';
}
