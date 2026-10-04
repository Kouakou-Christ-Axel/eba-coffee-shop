// lib/jeko/notify-paid.test.ts
//
// Une commande en ligne n'est annoncée qu'AU PAIEMENT : tant qu'elle attend, elle
// est invisible du staff (lib/orders/visibility.ts), donc `createOrder` ne notifie
// rien. Push staff et e-mail au propriétaire sont best-effort et indépendants :
// l'échec de l'un n'empêche jamais l'autre, et rien ne fait échouer le règlement.

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  default: { order: { findUnique: vi.fn() } },
}));
vi.mock('@/lib/push-notify', () => ({ sendPushToRoles: vi.fn() }));
vi.mock('@/lib/email', () => ({ sendNewOrderEmail: vi.fn() }));
vi.mock('@/lib/auth-helpers', () => ({
  ROLE_GROUPS: { DASHBOARD: ['ADMIN', 'MANAGER'] },
}));

import prisma from '@/lib/prisma';
import { sendPushToRoles } from '@/lib/push-notify';
import { sendNewOrderEmail } from '@/lib/email';
import { announcePaidOrder } from './notify-paid';

const findOrder = vi.mocked(prisma.order.findUnique);
const push = vi.mocked(sendPushToRoles);
const email = vi.mocked(sendNewOrderEmail);

const order = {
  id: 'o1',
  reference: 'EBA-20261003-AB12',
  dailyNumber: 7,
  customerName: 'Kofi Yao',
  customerPhone: '+2250701020304',
  pickupTime: null,
  orderType: 'TAKEAWAY',
  items: [],
  total: 3450,
};

describe('announcePaidOrder', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    findOrder.mockResolvedValue(order as never);
    push.mockResolvedValue(undefined as never);
    email.mockResolvedValue(undefined);
  });

  it('prévient le staff du dashboard avec le numéro, le montant et le client', async () => {
    await announcePaidOrder('o1');

    expect(push).toHaveBeenCalledTimes(1);
    const [roles, payload] = push.mock.calls[0];
    expect(roles).toEqual(['ADMIN', 'MANAGER']);
    expect(payload).toMatchObject({
      title: 'Nouvelle commande en ligne',
      url: '/dashboard/caisse',
      tag: 'order-o1',
    });
    expect(payload.body).toContain('#007');
    expect(payload.body).toContain('3450 FCFA');
    expect(payload.body).toContain('Kofi Yao');
    expect(payload.body).toContain('payée');
  });

  it('envoie aussi le courriel au propriétaire', async () => {
    await announcePaidOrder('o1');
    expect(email).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'o1', reference: 'EBA-20261003-AB12' })
    );
  });

  it("n'échoue pas et envoie quand même le courriel si le push échoue", async () => {
    push.mockRejectedValue(new Error('push indisponible'));

    await expect(announcePaidOrder('o1')).resolves.toBeUndefined();
    expect(email).toHaveBeenCalledTimes(1);
  });

  it("n'échoue pas et envoie quand même le push si le courriel échoue", async () => {
    email.mockRejectedValue(new Error('Resend indisponible'));

    await expect(announcePaidOrder('o1')).resolves.toBeUndefined();
    expect(push).toHaveBeenCalledTimes(1);
  });

  it('ne fait rien pour une commande introuvable', async () => {
    findOrder.mockResolvedValue(null as never);

    await expect(announcePaidOrder('o1')).resolves.toBeUndefined();
    expect(push).not.toHaveBeenCalled();
    expect(email).not.toHaveBeenCalled();
  });
});
