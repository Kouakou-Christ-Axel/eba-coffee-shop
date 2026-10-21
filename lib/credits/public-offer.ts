// lib/credits/public-offer.ts
//
// Avoir proposé au checkout public, retrouvé par le seul numéro de téléphone
// (pas de compte). Le serveur ré-applique la règle à la création de la commande :
// ce montant n'est qu'un aperçu. N'expose ni nom ni historique.

import prisma from '@/lib/prisma';
import { customerPhoneKey } from '@/lib/phone';
import { getCreditSettings } from '@/lib/credit-settings-db';
import { computeCreditApplication } from './apply';
import type { CreditOffer } from './offer';

export async function getPublicCreditOffer(
  rawPhone: string,
  total: number
): Promise<CreditOffer> {
  const none = { balance: 0, applicable: 0 };
  const phone = customerPhoneKey(rawPhone);
  if (!phone || total <= 0) return none;
  const customer = await prisma.customer.findUnique({
    where: { phone },
    select: { creditBalance: true },
  });
  if (!customer || customer.creditBalance <= 0) return none;
  const settings = await getCreditSettings();
  return {
    balance: customer.creditBalance,
    applicable: computeCreditApplication({
      balance: customer.creditBalance,
      total,
      settings,
    }),
  };
}
