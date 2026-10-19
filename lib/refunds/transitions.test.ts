import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RefundPrisma } from './test-utils';
import { admin, baseRefund, cashier, kitchen } from './test-utils';

const { prisma } = vi.hoisted(() => ({
  prisma: {} as RefundPrisma,
}));
vi.mock('@/lib/prisma', async () => {
  Object.assign(prisma, (await import('./test-utils')).refundPrismaMock());
  return { default: prisma };
});
vi.mock('./send-jeko', () => ({ sendRefundViaJeko: vi.fn() }));
vi.mock('./on-paid', () => ({ settleRefundPaid: vi.fn() }));

import { sendRefundViaJeko } from './send-jeko';
import { settleRefundPaid } from './on-paid';
import {
  approveRefund,
  cancelRefund,
  markRefundPaidManually,
  rejectRefund,
  resolveUncertainRefund,
  retryRefund,
  updateRefundDestination,
} from './transitions';

const send = vi.mocked(sendRefundViaJeko);
const settle = vi.mocked(settleRefundPaid);

/** Le remboursement est lu avec ce statut (puis relu après la transition). */
function givenRefund(overrides: Record<string, unknown> = {}) {
  const refund = { ...baseRefund, ...overrides };
  prisma.refund.findUnique.mockResolvedValue(refund);
  prisma.refund.updateMany.mockResolvedValue({ count: 1 });
  return refund;
}

describe('approveRefund', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    send.mockResolvedValue('processing');
    settle.mockResolvedValue(true);
  });

  it('valide puis envoie aussitôt un transfert Jèko', async () => {
    givenRefund();
    const { sent } = await approveRefund('r1', admin);

    expect(prisma.refund.updateMany).toHaveBeenCalledWith({
      where: { id: 'r1', status: 'REQUESTED' },
      data: expect.objectContaining({
        status: 'APPROVED',
        approvedById: 'admin1',
      }),
    });
    expect(send).toHaveBeenCalledWith('r1');
    expect(sent).toBe('processing');
    expect(prisma.refundEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fromStatus: 'REQUESTED',
        toStatus: 'APPROVED',
      }),
    });
  });

  it("remise à la main : valide sans rien envoyer (la caisse remet l'argent ensuite)", async () => {
    givenRefund({ delivery: 'MANUAL' });
    const { sent } = await approveRefund('r1', admin);
    expect(send).not.toHaveBeenCalled();
    expect(sent).toBeNull();
  });

  it('un admin peut valider sa propre demande', async () => {
    givenRefund({ requestedById: 'admin1' });
    await expect(approveRefund('r1', admin)).resolves.toBeTruthy();
  });

  it('refuse la caisse : seul un admin valide', async () => {
    givenRefund();
    await expect(approveRefund('r1', cashier)).rejects.toMatchObject({
      httpStatus: 403,
    });
    expect(send).not.toHaveBeenCalled();
  });

  it('double clic : déjà validé → conflit, aucun second envoi', async () => {
    givenRefund({ status: 'APPROVED' });
    await expect(approveRefund('r1', admin)).rejects.toMatchObject({
      httpStatus: 409,
    });
    expect(send).not.toHaveBeenCalled();
  });

  it('course perdue sur updateMany → conflit', async () => {
    givenRefund();
    prisma.refund.updateMany.mockResolvedValue({ count: 0 });
    await expect(approveRefund('r1', admin)).rejects.toMatchObject({
      httpStatus: 409,
    });
  });
});

describe('retryRefund', () => {
  beforeEach(() => vi.clearAllMocks());

  it('relance un échec : FAILED → APPROVED puis envoi', async () => {
    givenRefund({ status: 'FAILED', failureCode: 'insufficient_balance' });
    send.mockResolvedValue('paid');
    await retryRefund('r1', admin);
    expect(prisma.refund.updateMany).toHaveBeenCalledWith({
      where: { id: 'r1', status: 'FAILED' },
      data: expect.objectContaining({ status: 'APPROVED', failureCode: null }),
    });
    expect(send).toHaveBeenCalledWith('r1');
  });

  it('ne relance jamais un transfert « à vérifier » (risque de payer deux fois)', async () => {
    givenRefund({ status: 'UNCERTAIN' });
    await expect(retryRefund('r1', admin)).rejects.toMatchObject({
      httpStatus: 409,
    });
    expect(send).not.toHaveBeenCalled();
  });

  it('réservé aux admins', async () => {
    givenRefund({ status: 'FAILED' });
    await expect(retryRefund('r1', cashier)).rejects.toMatchObject({
      httpStatus: 403,
    });
  });
});

describe('updateRefundDestination', () => {
  beforeEach(() => vi.clearAllMocks());

  it('corriger le numéro repasse en « Demandé » : nouvelle validation admin avant envoi', async () => {
    givenRefund({
      status: 'FAILED',
      failureCode: 'transfer_failed',
      approvedById: 'admin1',
    });
    await updateRefundDestination(
      { id: 'r1', destinationPhone: '05 05 05 05 05' },
      cashier
    );

    expect(prisma.refund.updateMany).toHaveBeenCalledWith({
      where: { id: 'r1', status: 'FAILED' },
      data: expect.objectContaining({
        status: 'REQUESTED',
        destinationPhone: '+2250505050505',
        approvedById: null,
        approvedAt: null,
        failureCode: null,
      }),
    });
    expect(send).not.toHaveBeenCalled();
  });

  it('changer le mode : un canal sans transfert (espèces) exige une remise à la main', async () => {
    givenRefund({ status: 'FAILED' });
    await expect(
      updateRefundDestination({ id: 'r1', channel: 'CASH' }, cashier)
    ).rejects.toThrow('transfert');
    await expect(
      updateRefundDestination(
        { id: 'r1', channel: 'CASH', delivery: 'MANUAL' },
        cashier
      )
    ).resolves.toBeTruthy();
  });

  it('refuse un numéro invalide pour un transfert', async () => {
    givenRefund({ status: 'FAILED' });
    await expect(
      updateRefundDestination({ id: 'r1', destinationPhone: '12' }, cashier)
    ).rejects.toThrow('invalide');
  });

  it("n'a plus de prise une fois l'argent parti", async () => {
    givenRefund({ status: 'PAID' });
    await expect(
      updateRefundDestination(
        { id: 'r1', destinationPhone: '0505050505' },
        admin
      )
    ).rejects.toMatchObject({ httpStatus: 409 });
  });

  it('refuse un rôle sans accès caisse', async () => {
    givenRefund({ status: 'FAILED' });
    await expect(
      updateRefundDestination(
        { id: 'r1', destinationPhone: '0505050505' },
        kitchen
      )
    ).rejects.toMatchObject({ httpStatus: 403 });
  });
});

describe('rejectRefund / cancelRefund', () => {
  beforeEach(() => vi.clearAllMocks());

  it('un admin refuse une demande', async () => {
    givenRefund();
    await rejectRefund({ id: 'r1', note: 'Pas justifié' }, admin);
    expect(prisma.refund.updateMany).toHaveBeenCalledWith({
      where: { id: 'r1', status: 'REQUESTED' },
      data: { status: 'REJECTED' },
    });
  });

  it('ne refuse pas un transfert « à vérifier » ni un remboursement payé', async () => {
    givenRefund({ status: 'UNCERTAIN' });
    await expect(rejectRefund({ id: 'r1' }, admin)).rejects.toMatchObject({
      httpStatus: 409,
    });
    givenRefund({ status: 'PAID' });
    await expect(rejectRefund({ id: 'r1' }, admin)).rejects.toMatchObject({
      httpStatus: 409,
    });
  });

  it('le demandeur annule sa propre demande, pas celle d’un autre', async () => {
    givenRefund();
    await expect(cancelRefund({ id: 'r1' }, cashier)).resolves.toBeTruthy();
    await expect(
      cancelRefund({ id: 'r1' }, { id: 'cash2', role: 'CASHIER' })
    ).rejects.toMatchObject({ httpStatus: 403 });
    await expect(cancelRefund({ id: 'r1' }, admin)).resolves.toBeTruthy();
  });
});

describe('markRefundPaidManually', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settle.mockResolvedValue(true);
  });

  it('la caisse confirme la remise en main propre d’un remboursement approuvé', async () => {
    givenRefund({ delivery: 'MANUAL', status: 'APPROVED' });
    await markRefundPaidManually({ id: 'r1' }, cashier);
    expect(settle).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'r1',
        from: ['APPROVED'],
        actorId: 'cash1',
      })
    );
  });

  it('régler à la main un échec Jèko est réservé aux admins', async () => {
    givenRefund({ status: 'FAILED' });
    await expect(
      markRefundPaidManually({ id: 'r1' }, cashier)
    ).rejects.toMatchObject({
      httpStatus: 403,
    });
    await markRefundPaidManually({ id: 'r1', note: 'Fait depuis Jèko' }, admin);
    expect(settle).toHaveBeenCalledWith(
      expect.objectContaining({
        from: ['FAILED', 'UNCERTAIN'],
        note: 'Fait depuis Jèko',
      })
    );
  });

  it("déjà payé (course) → conflit, rien n'est compté deux fois", async () => {
    givenRefund({ delivery: 'MANUAL', status: 'APPROVED' });
    settle.mockResolvedValue(false);
    await expect(
      markRefundPaidManually({ id: 'r1' }, cashier)
    ).rejects.toMatchObject({
      httpStatus: 409,
    });
  });
});

describe('resolveUncertainRefund', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settle.mockResolvedValue(true);
  });

  it('« envoyé » : passe à PAID depuis UNCERTAIN', async () => {
    givenRefund({ status: 'UNCERTAIN' });
    await resolveUncertainRefund({ id: 'r1', outcome: 'SENT' }, admin);
    expect(settle).toHaveBeenCalledWith(
      expect.objectContaining({ from: ['UNCERTAIN'], actorId: 'admin1' })
    );
  });

  it('« pas envoyé » : retombe en FAILED, un nouvel essai prendra une référence neuve', async () => {
    givenRefund({ status: 'UNCERTAIN' });
    await resolveUncertainRefund({ id: 'r1', outcome: 'NOT_SENT' }, admin);
    expect(prisma.refund.updateMany).toHaveBeenCalledWith({
      where: { id: 'r1', status: 'UNCERTAIN' },
      data: expect.objectContaining({
        status: 'FAILED',
        failureCode: 'not_sent',
      }),
    });
    expect(settle).not.toHaveBeenCalled();
  });

  it('réservé aux admins', async () => {
    givenRefund({ status: 'UNCERTAIN' });
    await expect(
      resolveUncertainRefund({ id: 'r1', outcome: 'SENT' }, cashier)
    ).rejects.toMatchObject({ httpStatus: 403 });
  });
});
