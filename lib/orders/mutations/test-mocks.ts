// Fabriques des modules mockés (les `vi.mock` restent dans chaque test, hoisting vitest).

import { vi } from 'vitest';

export function prismaModuleMock() {
  const client = {
    order: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      // `getNextDailyNumber` (lib/daily-numbering.ts) lit MAX(dailyNumber).
      aggregate: vi.fn().mockResolvedValue({ _max: { dailyNumber: 4 } }),
    },
    customer: {
      findUnique: vi.fn(),
    },
    orderPayment: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    product: {
      updateMany: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    supplementOption: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    // Les transactions reçoivent le même client mocké : les assertions sur les
    // mocks de premier niveau couvrent donc aussi les opérations transactionnelles.
    // `$transaction([...])` (forme tableau, utilisée pour le dépaiement) résout
    // simplement chaque promesse déjà construite avec ce même client mocké.
    $transaction: vi.fn(
      async (arg: ((tx: unknown) => Promise<unknown>) | Promise<unknown>[]) =>
        Array.isArray(arg) ? Promise.all(arg) : arg(client)
    ),
  };
  return { default: client };
}

export const pushNotifyModuleMock = () => ({
  notifyOrderCustomer: vi.fn(),
  sendPushToRoles: vi.fn().mockResolvedValue(undefined),
});

// Collaborateurs de `createCashierOrder` sans intérêt pour ce qu'on teste ici
// (résolution du client CRM, fidélité) : neutralisés pour isoler la décision
// « ardoise » et la réservation de stock.
export const customerMutationsModuleMock = () => ({
  upsertCustomerForOrder: vi.fn().mockResolvedValue('cust-1'),
});

export const loyaltyMutationsModuleMock = () => ({
  awardLoyaltyForOrder: vi.fn().mockResolvedValue({ rewards: [] }),
  consumeLoyaltyReward: vi.fn().mockResolvedValue(undefined),
  resolveLoyaltyReward: vi.fn().mockResolvedValue(null),
  revokeLoyaltyForOrder: vi.fn().mockResolvedValue(undefined),
  restoreLoyaltyForOrder: vi.fn().mockResolvedValue(undefined),
  LoyaltyRewardUnavailableError: class LoyaltyRewardUnavailableError extends Error {},
});
