// lib/jeko/active-account.ts
//
// Compte Jèko qui encaisse les NOUVEAUX paiements (singleton `JekoSettings`). Les
// paiements déjà lancés restent sur leur compte (`Order.jekoAccount`).

import prisma from '@/lib/prisma';
import {
  DEFAULT_JEKO_ACCOUNT,
  parseJekoAccount,
  type JekoAccount,
} from './accounts';
import type { JekoConfig } from './client';
import { jekoConfig } from './config';

export async function getActiveJekoAccount(): Promise<JekoAccount> {
  const row = await prisma.jekoSettings.findUnique({
    where: { id: 'singleton' },
    select: { activeAccount: true },
  });
  return row ? parseJekoAccount(row.activeAccount) : DEFAULT_JEKO_ACCOUNT;
}

/** Compte actif et sa config ; `null` si ses variables ne sont pas toutes renseignées. */
export async function getActiveJekoConfig(): Promise<{
  account: JekoAccount;
  config: JekoConfig;
} | null> {
  const account = await getActiveJekoAccount();
  const config = jekoConfig(account);
  return config ? { account, config } : null;
}

/** Bascule le compte actif ; refuse un compte dont la config est incomplète. */
export async function setActiveJekoAccount(
  account: JekoAccount
): Promise<void> {
  if (!jekoConfig(account)) {
    throw new Error(
      `Le compte ${account} n'est pas configuré : renseignez ses variables d'environnement.`
    );
  }
  await prisma.jekoSettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', activeAccount: account },
    update: { activeAccount: account },
  });
}
