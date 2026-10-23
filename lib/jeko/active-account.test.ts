import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  default: { jekoSettings: { findUnique: vi.fn(), upsert: vi.fn() } },
}));
vi.mock('./config', () => ({ jekoConfig: vi.fn() }));

import prisma from '@/lib/prisma';
import {
  getActiveJekoAccount,
  getActiveJekoConfig,
  setActiveJekoAccount,
} from './active-account';
import { jekoConfig } from './config';

const find = vi.mocked(prisma.jekoSettings.findUnique);
const upsert = vi.mocked(prisma.jekoSettings.upsert);
const config = vi.mocked(jekoConfig);
const jeko = { apiKey: 'k', apiKeyId: 'i', storeId: 's' };

describe('compte Jèko actif', () => {
  beforeEach(() => vi.resetAllMocks());

  it('vaut A tant que rien n’est réglé', async () => {
    find.mockResolvedValue(null);
    await expect(getActiveJekoAccount()).resolves.toBe('A');
  });

  it('renvoie la config du compte actif, ou null si elle est incomplète', async () => {
    find.mockResolvedValue({ activeAccount: 'B' } as never);
    config.mockReturnValue(jeko);
    await expect(getActiveJekoConfig()).resolves.toEqual({
      account: 'B',
      config: jeko,
    });
    expect(config).toHaveBeenCalledWith('B');

    config.mockReturnValue(null);
    await expect(getActiveJekoConfig()).resolves.toBeNull();
  });

  it('refuse de basculer sur un compte non configuré', async () => {
    config.mockReturnValue(null);
    await expect(setActiveJekoAccount('B')).rejects.toThrow(/pas configuré/);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('bascule sur un compte configuré', async () => {
    config.mockReturnValue(jeko);
    await setActiveJekoAccount('B');
    expect(upsert).toHaveBeenCalledWith({
      where: { id: 'singleton' },
      create: { id: 'singleton', activeAccount: 'B' },
      update: { activeAccount: 'B' },
    });
  });
});
