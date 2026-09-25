// lib/restock-alerts.test.ts
//
// Alertes « de retour en stock » : inscription refusée si rien n'est épuisé,
// plafond par appareil, envoi UNIQUEMENT pour ce qui est revenu, usage unique
// (suppression avant envoi, pas de doublon en cas de déclenchements
// concurrents), purge des alertes trop anciennes.

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  default: {
    product: { findMany: vi.fn() },
    supplementGroup: { findMany: vi.fn() },
    restockAlert: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));
vi.mock('@/lib/push-notify', () => ({ sendPushToEndpoints: vi.fn() }));

import prisma from '@/lib/prisma';
import { sendPushToEndpoints } from '@/lib/push-notify';
import {
  isTargetBackInStock,
  notifyRestockAlerts,
  saveRestockAlert,
} from './restock-alerts';

const NOW = new Date('2026-09-25T10:00:00.000Z');
const db = vi.mocked(prisma, { deep: true });

const product = (id: string, stockQuantity: number | null, extra = {}) => ({
  id,
  name: id,
  available: true,
  deletedAt: null,
  stockQuantity,
  unavailableUntil: null,
  supplementGroups: [] as {
    name: string;
    options: { name: string; stockQuantity: number | null }[];
  }[],
  ...extra,
});

const subscription = {
  endpoint: 'https://push.example/abc',
  keys: { p256dh: 'p', auth: 'a' },
};

beforeEach(() => {
  vi.clearAllMocks();
  db.supplementGroup.findMany.mockResolvedValue([]);
  db.restockAlert.deleteMany.mockResolvedValue({ count: 1 });
});

describe('isTargetBackInStock', () => {
  const base = {
    available: true,
    deletedAt: null,
    stockQuantity: 3,
    unavailableUntil: null,
  };

  it('produit en stock (ou illimité) : oui', () => {
    expect(isTargetBackInStock(base, null, NOW)).toBe(true);
    expect(
      isTargetBackInStock({ ...base, stockQuantity: null }, null, NOW)
    ).toBe(true);
  });

  it('épuisé, en pause, désactivé ou supprimé : non', () => {
    expect(isTargetBackInStock({ ...base, stockQuantity: 0 }, null, NOW)).toBe(
      false
    );
    expect(
      isTargetBackInStock(
        { ...base, unavailableUntil: new Date('2026-09-26T00:00:00Z') },
        null,
        NOW
      )
    ).toBe(false);
    expect(isTargetBackInStock({ ...base, available: false }, null, NOW)).toBe(
      false
    );
    expect(isTargetBackInStock(undefined, null, NOW)).toBe(false);
  });

  it('goût : il faut aussi que l’option soit revenue', () => {
    expect(isTargetBackInStock(base, { stockQuantity: 0 }, NOW)).toBe(false);
    expect(isTargetBackInStock(base, { stockQuantity: 4 }, NOW)).toBe(true);
    expect(isTargetBackInStock(base, undefined, NOW)).toBe(false);
  });
});

describe('saveRestockAlert', () => {
  it('refuse une alerte sur un produit disponible (409)', async () => {
    db.product.findMany.mockResolvedValue([product('cookie', 4)] as never);
    await expect(
      saveRestockAlert({ productId: 'cookie' }, subscription)
    ).rejects.toMatchObject({ httpStatus: 409 });
    expect(db.restockAlert.upsert).not.toHaveBeenCalled();
  });

  it('refuse un produit inconnu (404)', async () => {
    db.product.findMany.mockResolvedValue([]);
    await expect(
      saveRestockAlert({ productId: 'nope' }, subscription)
    ).rejects.toMatchObject({ httpStatus: 404 });
  });

  it('plafonne le nombre d’alertes par appareil (429)', async () => {
    db.product.findMany.mockResolvedValue([product('sponge', 0)] as never);
    db.restockAlert.findUnique.mockResolvedValue(null);
    db.restockAlert.count.mockResolvedValue(20);
    await expect(
      saveRestockAlert({ productId: 'sponge' }, subscription)
    ).rejects.toMatchObject({ httpStatus: 429 });
  });

  it('enregistre une alerte sur un goût épuisé', async () => {
    db.product.findMany.mockResolvedValue([
      product('sponge', 5, {
        supplementGroups: [
          { name: 'Goût', options: [{ name: 'Vanille', stockQuantity: 0 }] },
        ],
      }),
    ] as never);
    db.restockAlert.findUnique.mockResolvedValue(null);
    db.restockAlert.count.mockResolvedValue(0);

    await saveRestockAlert(
      { productId: 'sponge', groupName: 'Goût', optionName: 'Vanille' },
      subscription
    );

    expect(db.restockAlert.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          endpoint_targetKey: {
            endpoint: subscription.endpoint,
            targetKey: 'sponge|Goût|Vanille',
          },
        },
      })
    );
  });
});

describe('notifyRestockAlerts', () => {
  const alert = (id: string, productId: string, extra = {}) => ({
    id,
    productId,
    groupName: null,
    optionName: null,
    targetKey: productId,
    endpoint: `https://push.example/${id}`,
    p256dh: 'p',
    auth: 'a',
    createdAt: NOW,
    ...extra,
  });

  it('ne prévient que pour ce qui est revenu, puis supprime l’alerte', async () => {
    db.restockAlert.findMany.mockResolvedValue([
      alert('a1', 'sponge'),
      alert('a2', 'brownie'),
    ] as never);
    db.product.findMany.mockResolvedValue([
      product('sponge', 6),
      product('brownie', 0),
    ] as never);

    const sent = await notifyRestockAlerts(NOW);

    expect(sent).toBe(1);
    expect(db.restockAlert.deleteMany).toHaveBeenCalledWith({
      where: { id: 'a1' },
    });
    expect(sendPushToEndpoints).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendPushToEndpoints).mock.calls[0][1]).toMatchObject({
      title: 'sponge est de retour !',
      url: '/carte?p=sponge',
    });
  });

  it('n’envoie pas deux fois si un autre déclenchement a déjà pris l’alerte', async () => {
    db.restockAlert.findMany.mockResolvedValue([
      alert('a1', 'sponge'),
    ] as never);
    db.product.findMany.mockResolvedValue([product('sponge', 6)] as never);
    db.restockAlert.deleteMany
      .mockResolvedValueOnce({ count: 0 }) // purge TTL
      .mockResolvedValueOnce({ count: 0 }); // alerte déjà supprimée

    expect(await notifyRestockAlerts(NOW)).toBe(0);
    expect(sendPushToEndpoints).not.toHaveBeenCalled();
  });

  it('purge d’abord les alertes plus vieilles que la durée de vie', async () => {
    db.restockAlert.findMany.mockResolvedValue([]);
    await notifyRestockAlerts(NOW);
    expect(db.restockAlert.deleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: new Date('2026-09-18T10:00:00.000Z') } },
    });
  });
});
