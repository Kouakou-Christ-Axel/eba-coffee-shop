// app/api/commandes/route.errors.test.ts
//
// Contrat d'erreur de POST /api/commandes : chaque réponse porte un `code`
// stable (`checkoutErrorCodeSchema`, lib/schemas/order.ts) sur lequel le
// checkout aiguille. `createOrder` est mocké — sa logique métier est testée
// ailleurs ; on vérifie ici le mapping erreur → statut/payload.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({ default: {} }));
vi.mock('@/lib/email', () => ({
  sendNewOrderEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/orders', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/orders')>()),
  createOrder: vi.fn(),
}));

import {
  AdvanceOrderRequiredError,
  ScheduleUnavailableError,
  SoldOutTodayError,
  createOrder,
} from '@/lib/orders';
import { LoyaltyRewardUnavailableError } from '@/lib/loyalty-mutations';
import { POST } from './route';

const mockCreateOrder = vi.mocked(createOrder);

const validBody = {
  customerName: 'Kofi',
  customerPhone: '07001234',
  pickupTime: null,
  items: [
    {
      cartId: 'abc123',
      productId: 'prod-1',
      productName: 'Cappuccino',
      basePrice: 3500,
      coutMatiere: 0,
      coutEmballage: 0,
      quantity: 1,
      supplements: [],
    },
  ],
  total: 3500,
};

function post(body: unknown) {
  return POST(
    new NextRequest('http://localhost/api/commandes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    })
  );
}

describe('POST /api/commandes — codes d’erreur', () => {
  beforeEach(() => {
    mockCreateOrder.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('INVALID_BODY sur un JSON illisible', async () => {
    const res = await post('pas du json');
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: 'INVALID_BODY' });
  });

  it('VALIDATION sur un body refusé par le schéma', async () => {
    const res = await post({ ...validBody, items: [] });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: 'VALIDATION' });
  });

  it('SOLD_OUT_TODAY en 409 avec les lignes fautives', async () => {
    const line = {
      cartId: 'abc123',
      productId: 'prod-1',
      productName: 'Cappuccino',
      missingProduct: true,
      missingOptionNames: [],
      remaining: 0,
    };
    mockCreateOrder.mockRejectedValue(new SoldOutTodayError([line, line]));

    const res = await post(validBody);
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.code).toBe('SOLD_OUT_TODAY');
    expect(json.items).toEqual([line, line]);
    // Nom dédoublonné dans le message lisible.
    expect(json.error).toBe(
      'Cappuccino : épuisé aujourd’hui. Choisissez un retrait à partir de demain.'
    );
  });

  it('ADVANCE_ORDER_REQUIRED avec le délai requis', async () => {
    mockCreateOrder.mockRejectedValue(new AdvanceOrderRequiredError(2));
    const res = await post(validBody);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      code: 'ADVANCE_ORDER_REQUIRED',
      requiredDays: 2,
    });
  });

  it('SCHEDULE_UNAVAILABLE avec le produit en cause', async () => {
    mockCreateOrder.mockRejectedValue(new ScheduleUnavailableError('Brunch'));
    const res = await post(validBody);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      code: 'SCHEDULE_UNAVAILABLE',
      productName: 'Brunch',
    });
  });

  it('LOYALTY_REWARD_UNAVAILABLE', async () => {
    mockCreateOrder.mockRejectedValue(new LoyaltyRewardUnavailableError());
    const res = await post(validBody);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      code: 'LOYALTY_REWARD_UNAVAILABLE',
    });
  });

  it('SERVER_ERROR en 500 sur une erreur inattendue', async () => {
    mockCreateOrder.mockRejectedValue(new Error('DB down'));
    const res = await post(validBody);
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ code: 'SERVER_ERROR' });
  });
});
