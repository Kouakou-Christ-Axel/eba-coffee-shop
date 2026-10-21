// lib/credits/apply.ts
//
// Règle d'usage de l'avoir, pure (serveur ET client : le panier affiche le même
// montant que celui que le serveur imposera).
//
//   A = max(0, min(solde, total − reste minimum, ⌊total × plafond %⌋))
//
// Le client paie donc toujours au moins `minRemaining` F (frais Jèko couverts,
// jamais de commande à zéro) et l'avoir ne couvre jamais plus de `maxPercent` %.

import type { CreditSettings } from '@/lib/credit-settings';

export function computeCreditApplication(args: {
  balance: number;
  total: number;
  settings: Pick<CreditSettings, 'enabled' | 'minRemaining' | 'maxPercent'>;
}): number {
  const { balance, total, settings } = args;
  if (!settings.enabled || balance <= 0 || total <= 0) return 0;
  const byRemaining = total - settings.minRemaining;
  const byPercent = Math.floor((total * settings.maxPercent) / 100);
  return Math.max(0, Math.min(balance, byRemaining, byPercent));
}
