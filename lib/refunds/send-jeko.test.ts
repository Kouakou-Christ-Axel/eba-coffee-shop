import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RefundPrisma } from './test-utils';

const { prisma } = vi.hoisted(() => ({ prisma: {} as RefundPrisma }));
vi.mock('@/lib/prisma', async () => {
  Object.assign(prisma, (await import('./test-utils')).refundPrismaMock());
  return { default: prisma };
});
vi.mock('@/lib/jeko/config', () => ({ jekoConfig: vi.fn() }));
vi.mock('@/lib/jeko/transfers', async (orig) => ({
  ...(await orig<typeof import('@/lib/jeko/transfers')>()),
  createJekoContact: vi.fn(),
  createJekoTransfer: vi.fn(),
}));
vi.mock('./on-paid', () => ({ settleRefundPaid: vi.fn() }));
vi.mock('./alerts', () => ({ notifyRefundProblem: vi.fn() }));

import { JekoApiError } from '@/lib/jeko/client';
import { jekoConfig } from '@/lib/jeko/config';
import { createJekoContact, createJekoTransfer } from '@/lib/jeko/transfers';
import { notifyRefundProblem } from './alerts';
import { settleRefundPaid } from './on-paid';
import { refundReference, sendRefundViaJeko } from './send-jeko';

const contact = vi.mocked(createJekoContact);
const transfer = vi.mocked(createJekoTransfer);
const settle = vi.mocked(settleRefundPaid);
const alert = vi.mocked(notifyRefundProblem);

const refund = {
  amount: 1000,
  channel: 'WAVE',
  destinationPhone: '+2250707070707',
  customerName: 'Awa',
  attempt: 1,
  order: { reference: 'EBA-20261003-AB12' },
};

/** Le dernier passage de statut écrit par `transitionRefund`. */
const lastTransition = () => {
  const calls = prisma.refund.updateMany.mock.calls;
  return calls[calls.length - 1][0];
};

describe('sendRefundViaJeko', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.refund.updateMany.mockResolvedValue({ count: 1 });
    prisma.refund.findUniqueOrThrow.mockResolvedValue(refund);
    prisma.refund.findUnique.mockResolvedValue({ status: 'PROCESSING' });
    vi.mocked(jekoConfig).mockReturnValue({
      apiKey: 'k',
      apiKeyId: 'i',
      storeId: 's',
    });
    contact.mockResolvedValue({ id: 'c1' });
    transfer.mockResolvedValue({ id: 'wth_1', status: 'pending', feeFcfa: 12 });
    settle.mockResolvedValue(true);
  });

  it('réclame le remboursement AVANT tout appel réseau (APPROVED → PROCESSING, essai + 1)', async () => {
    await sendRefundViaJeko('r1');
    expect(prisma.refund.updateMany.mock.calls[0][0]).toEqual({
      where: { id: 'r1', status: 'APPROVED', delivery: 'JEKO_TRANSFER' },
      data: { status: 'PROCESSING', attempt: { increment: 1 } },
    });
    expect(prisma.refund.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      contact.mock.invocationCallOrder[0]
    );
  });

  it('déjà réclamé (double clic, rejeu) : ne fait rien, aucun appel Jèko', async () => {
    prisma.refund.updateMany.mockResolvedValue({ count: 0 });
    await expect(sendRefundViaJeko('r1')).resolves.toBe('skipped');
    expect(contact).not.toHaveBeenCalled();
    expect(transfer).not.toHaveBeenCalled();
  });

  it('transfert pending : note l’identifiant Jèko et reste PROCESSING', async () => {
    await expect(sendRefundViaJeko('r1')).resolves.toBe('processing');
    expect(transfer).toHaveBeenCalledWith(expect.anything(), {
      contactId: 'c1',
      amountFcfa: 1000,
      reference: refundReference('r1', 1),
      description: 'Remboursement commande EBA-20261003-AB12',
    });
    expect(prisma.refund.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { jekoTransferId: 'wth_1', feeFcfa: 12 },
    });
    expect(settle).not.toHaveBeenCalled();
  });

  it('transfert déjà abouti : passe à PAID', async () => {
    transfer.mockResolvedValue({ id: 'wth_1', status: 'success', feeFcfa: 12 });
    await expect(sendRefundViaJeko('r1')).resolves.toBe('paid');
    expect(settle).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'r1',
        from: ['PROCESSING'],
        jekoTransferId: 'wth_1',
        feeFcfa: 12,
      })
    );
  });

  it('la référence change à chaque essai (Jèko refuse une référence réutilisée)', () => {
    expect(refundReference('r1', 1)).not.toBe(refundReference('r1', 2));
  });

  it('solde insuffisant : FAILED avec le code, l’admin est prévenu', async () => {
    transfer.mockRejectedValue(
      new JekoApiError(400, 'insufficient_balance', 'Insufficient balance')
    );
    await expect(sendRefundViaJeko('r1')).resolves.toBe('failed');
    expect(lastTransition().data).toMatchObject({
      status: 'FAILED',
      failureCode: 'insufficient_balance',
    });
    expect(alert).toHaveBeenCalledWith('r1', 'FAILED');
  });

  it('contact refusé : FAILED (aucun transfert tenté, sûr de réessayer)', async () => {
    contact.mockRejectedValue(
      new JekoApiError(422, 'validation_error', 'Validation error')
    );
    await expect(sendRefundViaJeko('r1')).resolves.toBe('failed');
    expect(transfer).not.toHaveBeenCalled();
    expect(lastTransition().data).toMatchObject({
      failureCode: 'validation_error',
    });
  });

  it('contact : même un timeout reste un échec sûr (rien n’est parti)', async () => {
    contact.mockRejectedValue(
      new JekoApiError(504, 'timeout', 'Jèko ne répond pas')
    );
    await expect(sendRefundViaJeko('r1')).resolves.toBe('failed');
  });

  it.each([
    ['timeout', new JekoApiError(504, 'timeout', 'Jèko ne répond pas')],
    [
      'panne réseau',
      new JekoApiError(503, 'network_error', 'Jèko injoignable'),
    ],
    ['erreur serveur', new JekoApiError(500, 'server_error', 'Oups')],
    [
      'référence déjà vue',
      new JekoApiError(409, 'transaction_exists_with_reference', 'Existe'),
    ],
  ])(
    '%s PENDANT le transfert : UNCERTAIN, jamais de renvoi automatique',
    async (_n, err) => {
      transfer.mockRejectedValue(err);
      await expect(sendRefundViaJeko('r1')).resolves.toBe('uncertain');
      expect(lastTransition().data).toMatchObject({ status: 'UNCERTAIN' });
      expect(alert).toHaveBeenCalledWith('r1', 'UNCERTAIN');
      expect(transfer).toHaveBeenCalledTimes(1);
    }
  );

  it('transfert renvoyé en erreur : FAILED transfer_failed', async () => {
    transfer.mockResolvedValue({ id: 'wth_1', status: 'error', feeFcfa: 0 });
    await expect(sendRefundViaJeko('r1')).resolves.toBe('failed');
    expect(lastTransition().data).toMatchObject({
      failureCode: 'transfer_failed',
    });
  });

  it('Jèko non configuré, numéro ou canal invalide, montant sous le minimum : FAILED sans appel Jèko', async () => {
    vi.mocked(jekoConfig).mockReturnValue(null);
    await expect(sendRefundViaJeko('r1')).resolves.toBe('failed');
    expect(lastTransition().data).toMatchObject({
      failureCode: 'jeko_not_configured',
    });

    vi.mocked(jekoConfig).mockReturnValue({
      apiKey: 'k',
      apiKeyId: 'i',
      storeId: 's',
    });
    prisma.refund.findUniqueOrThrow.mockResolvedValue({
      ...refund,
      channel: 'CASH',
    });
    await expect(sendRefundViaJeko('r1')).resolves.toBe('failed');
    expect(lastTransition().data).toMatchObject({
      failureCode: 'invalid_destination',
    });

    prisma.refund.findUniqueOrThrow.mockResolvedValue({
      ...refund,
      destinationPhone: 'abc',
    });
    await expect(sendRefundViaJeko('r1')).resolves.toBe('failed');

    prisma.refund.findUniqueOrThrow.mockResolvedValue({
      ...refund,
      channel: 'MOOV_MONEY',
      amount: 90,
    });
    await expect(sendRefundViaJeko('r1')).resolves.toBe('failed');
    expect(lastTransition().data).toMatchObject({
      failureCode: 'validation_error',
    });
    expect(contact).not.toHaveBeenCalled();
  });
});
