// lib/jeko/accounts.ts
//
// Deux comptes Jèko : A (variables JEKO_*, historique) et B (JEKO_B_*). Le compte
// ACTIF ne sert qu'à créer de nouveaux paiements ; tout ce qui concerne une commande
// existante lit `Order.jekoAccount`.

export const JEKO_ACCOUNTS = ['A', 'B'] as const;
export type JekoAccount = (typeof JEKO_ACCOUNTS)[number];

export const DEFAULT_JEKO_ACCOUNT: JekoAccount = 'A';

export function parseJekoAccount(value: unknown): JekoAccount {
  return value === 'B' ? 'B' : DEFAULT_JEKO_ACCOUNT;
}
