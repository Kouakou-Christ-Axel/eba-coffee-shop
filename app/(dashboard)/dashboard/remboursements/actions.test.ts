import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/auth-helpers', () => ({ requireRefundsView: vi.fn() }));
vi.mock('@/lib/refunds/create', () => ({ createRefund: vi.fn() }));
vi.mock('@/lib/refunds/transitions', () => ({
  approveRefund: vi.fn(),
  cancelRefund: vi.fn(),
  markRefundPaidManually: vi.fn(),
  rejectRefund: vi.fn(),
  resolveUncertainRefund: vi.fn(),
  retryRefund: vi.fn(),
  updateRefundDestination: vi.fn(),
}));
vi.mock('@/lib/order-mutations', () => ({ setOrderStatus: vi.fn() }));

import { revalidatePath } from 'next/cache';
import { requireRefundsView } from '@/lib/auth-helpers';
import { setOrderStatus } from '@/lib/order-mutations';
import { createRefund } from '@/lib/refunds/create';
import { approveRefund, retryRefund } from '@/lib/refunds/transitions';
import {
  approveRefundAction,
  requestRefundAction,
  retryRefundAction,
} from './actions';

const session = (role: string) => ({ user: { id: 'u1', role } }) as never;

describe('actions remboursements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRefundsView).mockResolvedValue(session('ADMIN'));
    vi.mocked(createRefund).mockResolvedValue({ id: 'r1' } as never);
    vi.mocked(approveRefund).mockResolvedValue({
      refund: {},
      sent: 'processing',
    } as never);
  });

  it('transmet l’identité de la session à la couche métier (jamais celle du navigateur)', async () => {
    await requestRefundAction({ orderId: 'o1', amount: 500 });
    expect(createRefund).toHaveBeenCalledWith(
      { orderId: 'o1', amount: 500 },
      { id: 'u1', role: 'ADMIN' }
    );
  });

  it('renvoie l’erreur métier lisible au lieu de la laisser traverser (Next la masque)', async () => {
    vi.mocked(approveRefund).mockRejectedValue(
      new Error('Réservé à un administrateur')
    );
    await expect(approveRefundAction('r1')).resolves.toEqual({
      ok: false,
      error: 'Réservé à un administrateur',
    });
  });

  it('refuse d’emblée un rôle sans accès aux remboursements', async () => {
    vi.mocked(requireRefundsView).mockRejectedValue(new Error('Non autorisé'));
    await expect(requestRefundAction({})).resolves.toMatchObject({ ok: false });
    expect(createRefund).not.toHaveBeenCalled();
  });

  it('« Demander et valider » : crée puis valide, et dit où en est le transfert', async () => {
    const r = await requestRefundAction(
      { orderId: 'o1', amount: 500 },
      { approveNow: true }
    );
    expect(approveRefund).toHaveBeenCalledWith('r1', {
      id: 'u1',
      role: 'ADMIN',
    });
    expect(r).toEqual({
      ok: true,
      message: 'Transfert lancé : en attente de la réponse de Jèko.',
    });
  });

  it('demande simple : rien n’est validé, le message le dit', async () => {
    const r = await requestRefundAction({ orderId: 'o1', amount: 500 });
    expect(approveRefund).not.toHaveBeenCalled();
    expect(r).toMatchObject({
      ok: true,
      message: expect.stringContaining('valider'),
    });
  });

  it('annule la commande seulement si demandé', async () => {
    await requestRefundAction(
      { orderId: 'o1', amount: 500 },
      { cancelOrder: true }
    );
    expect(setOrderStatus).toHaveBeenCalledWith('o1', 'CANCELLED', 'ADMIN');
    vi.mocked(setOrderStatus).mockClear();
    await requestRefundAction({ orderId: 'o1', amount: 500 });
    expect(setOrderStatus).not.toHaveBeenCalled();
  });

  it('rafraîchit les pages qui affichent ces chiffres', async () => {
    await retryRefundAction('r1').catch(() => {});
    vi.mocked(retryRefund).mockResolvedValue({
      refund: {},
      sent: 'failed',
    } as never);
    await retryRefundAction('r1');
    const paths = vi.mocked(revalidatePath).mock.calls.map((c) => c[0]);
    expect(paths).toEqual(
      expect.arrayContaining([
        '/dashboard/remboursements',
        '/dashboard/statistiques',
        '/dashboard/cloture',
        '/dashboard/jeko',
      ])
    );
  });
});
