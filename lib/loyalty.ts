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

// ─── Récap fidélité pour les messages client (récap Wave/WhatsApp) ────────────
//
// Un seul cas s'applique par commande, par ordre de priorité :
//   1. programme désactivé                → pas de bloc (null)
//   2. commande anonyme (pas de client)    → invite à laisser son numéro
//   3. récompense appliquée à CETTE commande (`Order.loyaltyDiscount`) → le dire
//   4. client a une récompense dispo NON appliquée cette fois → le lui rappeler
//   5. sinon → avancement de la carte (tampons)

export type LoyaltyRecapInfo =
  | { kind: 'reward_applied'; amount: number }
  | { kind: 'reward_available'; amount: number }
  | { kind: 'progress'; stampCount: number; stampsPerCard: number }
  | { kind: 'anonymous' };

type LoyaltyRecapLookup = {
  enabled: boolean;
  stampsPerCard: number;
  byCustomer: Map<
    string,
    { stampCount: number; availableRewardAmount: number | null }
  >;
};

/**
 * Précalcule (en 2 requêtes batchées, pas de N+1) les données fidélité de
 * plusieurs clients à la fois — pour une liste de commandes (file caisse).
 */
export async function getLoyaltyRecapLookup(
  customerIds: (string | null)[]
): Promise<LoyaltyRecapLookup> {
  const settings = await getLoyaltySettings();
  const ids = [...new Set(customerIds.filter((id): id is string => !!id))];
  if (ids.length === 0) {
    return {
      enabled: settings.enabled,
      stampsPerCard: settings.stampsPerCard,
      byCustomer: new Map(),
    };
  }

  const [customers, rewards] = await Promise.all([
    prisma.customer.findMany({
      where: { id: { in: ids } },
      select: { id: true, stampCount: true },
    }),
    prisma.loyaltyReward.findMany({
      where: { customerId: { in: ids }, status: 'AVAILABLE' },
      orderBy: { earnedAt: 'asc' },
      select: { customerId: true, capAmount: true },
    }),
  ]);

  // La plus ancienne récompense dispo par client (une seule mise en avant).
  const rewardByCustomer = new Map<string, number>();
  for (const r of rewards) {
    if (!rewardByCustomer.has(r.customerId)) {
      rewardByCustomer.set(r.customerId, r.capAmount);
    }
  }

  const byCustomer = new Map(
    customers.map((c) => [
      c.id,
      {
        stampCount: c.stampCount,
        availableRewardAmount: rewardByCustomer.get(c.id) ?? null,
      },
    ])
  );

  return {
    enabled: settings.enabled,
    stampsPerCard: settings.stampsPerCard,
    byCustomer,
  };
}

/** Résout le bloc fidélité d'UNE commande à partir d'un lookup précalculé. */
export function resolveLoyaltyRecap(
  order: { customerId: string | null; loyaltyDiscount: number | null },
  lookup: LoyaltyRecapLookup
): LoyaltyRecapInfo | null {
  if (!lookup.enabled) return null;
  if (!order.customerId) return { kind: 'anonymous' };
  if (order.loyaltyDiscount && order.loyaltyDiscount > 0) {
    return { kind: 'reward_applied', amount: order.loyaltyDiscount };
  }
  const info = lookup.byCustomer.get(order.customerId);
  if (!info) return null;
  if (info.availableRewardAmount != null) {
    return { kind: 'reward_available', amount: info.availableRewardAmount };
  }
  return {
    kind: 'progress',
    stampCount: info.stampCount,
    stampsPerCard: lookup.stampsPerCard,
  };
}

/** Commodité pour une commande unique (page de détail) — évite de manier le lookup. */
export async function getLoyaltyRecapForOrder(order: {
  customerId: string | null;
  loyaltyDiscount: number | null;
}): Promise<LoyaltyRecapInfo | null> {
  const lookup = await getLoyaltyRecapLookup([order.customerId]);
  return resolveLoyaltyRecap(order, lookup);
}
