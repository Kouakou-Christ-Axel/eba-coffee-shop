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
