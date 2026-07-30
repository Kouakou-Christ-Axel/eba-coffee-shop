// lib/loyalty.ts
//
// Lecture de la carte de fidélité d'un client (avancement + récompenses dispo).

import prisma from '@/lib/prisma';
import { customerPhoneKey } from '@/lib/phone';
import { getLoyaltySettings } from '@/lib/loyalty-settings-db';

export async function getLoyaltyCard(customerId: string) {
  const [settings, customer, availableRewards] = await Promise.all([
    getLoyaltySettings(),
    prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, name: true, phone: true, stampCount: true },
    }),
    prisma.loyaltyReward.findMany({
      where: { customerId, status: 'AVAILABLE' },
      orderBy: { earnedAt: 'asc' },
    }),
  ]);
  if (!customer) return null;

  return {
    customer,
    settings,
    stampCount: customer.stampCount,
    availableRewards,
  };
}

export async function getLoyaltyCardByPhone(rawPhone: string) {
  const key = customerPhoneKey(rawPhone);
  if (!key) return null;
  const customer = await prisma.customer.findUnique({
    where: { phone: key },
    select: { id: true },
  });
  return customer ? getLoyaltyCard(customer.id) : null;
}

/**
 * Récompense utilisable pour un téléphone (checkout en ligne, sans compte) :
 * la plus ancienne `AVAILABLE` du client résolu par téléphone, ou `null`
 * (programme désactivé, client inconnu, rien à utiliser).
 *
 * Exposition volontairement MINIMALE (id + plafond) : ni nom, ni compteur de
 * tampons — moins que ce que la page de suivi montre déjà à quiconque détient
 * l'URL. La consommation reste validée côté serveur dans la transaction de
 * commande (`resolveLoyaltyReward`), contre le client résolu du MÊME téléphone
 * que la commande.
 */
export async function getAvailableRewardForPhone(
  rawPhone: string
): Promise<{ id: string; capAmount: number } | null> {
  const card = await getLoyaltyCardByPhone(rawPhone);
  if (!card || !card.settings.enabled) return null;
  const reward = card.availableRewards[0];
  return reward ? { id: reward.id, capAmount: reward.capAmount } : null;
}
