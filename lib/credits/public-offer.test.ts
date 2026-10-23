import { beforeEach, describe, expect, it, vi } from 'vitest';

const prisma = vi.hoisted(() => ({
  customer: { findUnique: vi.fn() },
  customerCreditEntry: { findMany: vi.fn() },
  order: { findMany: vi.fn() },
}));
vi.mock('@/lib/prisma', () => ({ default: prisma }));
vi.mock('@/lib/daily-numbering', () => ({
  todayDailyDate: () => new Date('2026-10-21T00:00:00Z'),
}));
const settings = vi.hoisted(() => ({ getCreditSettings: vi.fn() }));
vi.mock('@/lib/credit-settings-db', () => settings);

import { getPublicCreditOffer } from './public-offer';

const on = {
  enabled: true,
  minRemaining: 1500,
  maxPercent: 70,
  onlineEnabled: true,
  onlineDailyCap: 5000,
};

describe('getPublicCreditOffer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.customer.findUnique.mockResolvedValue({
      id: 'cu1',
      creditBalance: 4000,
    });
    prisma.customerCreditEntry.findMany.mockResolvedValue([]);
  });

  it('usage en ligne coupé : même réponse vide, sans même lire le client (aucune fuite)', async () => {
    settings.getCreditSettings.mockResolvedValue({
      ...on,
      onlineEnabled: false,
    });
    await expect(getPublicCreditOffer('0707070707', 5000)).resolves.toEqual({
      balance: 0,
      applicable: 0,
    });
    expect(prisma.customer.findUnique).not.toHaveBeenCalled();
  });

  it('activé : propose la part autorisée', async () => {
    settings.getCreditSettings.mockResolvedValue(on);
    await expect(getPublicCreditOffer('0707070707', 5000)).resolves.toEqual({
      balance: 4000,
      applicable: 3500,
    });
  });

  it('activé : plafond journalier', async () => {
    settings.getCreditSettings.mockResolvedValue({
      ...on,
      onlineDailyCap: 1000,
    });
    await expect(
      getPublicCreditOffer('0707070707', 5000)
    ).resolves.toMatchObject({ applicable: 1000 });
  });
});
