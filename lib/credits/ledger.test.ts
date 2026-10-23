import { beforeEach, describe, expect, it, vi } from 'vitest';
import { moveCredit } from './ledger';

const tx = {
  $queryRaw: vi.fn(),
  customer: { update: vi.fn() },
  customerCreditEntry: { create: vi.fn() },
};
const run = (delta: number) =>
  moveCredit(tx as never, { customerId: 'cu1', delta, kind: 'SPENT' });

describe('moveCredit', () => {
  beforeEach(() => vi.clearAllMocks());

  it('met à jour le solde et journalise le mouvement', async () => {
    tx.$queryRaw.mockResolvedValue([{ creditBalance: 3000 }]);
    await expect(run(-1200)).resolves.toBe(1800);
    expect(tx.customer.update).toHaveBeenCalledWith({
      where: { id: 'cu1' },
      data: { creditBalance: 1800 },
    });
    expect(tx.customerCreditEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ delta: -1200, balanceAfter: 1800 }),
    });
  });

  it('refuse de passer sous zéro, sans rien écrire', async () => {
    tx.$queryRaw.mockResolvedValue([{ creditBalance: 500 }]);
    await expect(run(-501)).rejects.toThrow(/insuffisant/);
    expect(tx.customer.update).not.toHaveBeenCalled();
    expect(tx.customerCreditEntry.create).not.toHaveBeenCalled();
  });

  it('client introuvable : 404', async () => {
    tx.$queryRaw.mockResolvedValue([]);
    await expect(run(100)).rejects.toMatchObject({ httpStatus: 404 });
  });

  it('refuse un montant nul ou non entier', async () => {
    await expect(run(0)).rejects.toThrow();
    await expect(run(10.5)).rejects.toThrow();
  });
});
