// app/api/commandes/route.rate-limit.test.ts
//
// Anti-abus de POST /api/commandes (voir lib/order-create-rate-limit.ts) :
// isolé dans son propre fichier pour que le compteur en mémoire (`unknown`
// = pas d'IP en test) ne soit pas partagé avec route.test.ts /
// route.errors.test.ts, qui envoient chacun plusieurs requêtes valides.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  default: { order: { create: vi.fn(), findUnique: vi.fn() } },
}));
vi.mock('@/lib/email', () => ({
  sendNewOrderEmail: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from './route';

const validBody = {
  customerName: 'Kofi Yao',
  customerPhone: '07001234',
  pickupTime: null,
  items: [
    {
      cartId: 'abc123',
      productId: 'prod-1',
      productName: 'Cappuccino',
      basePrice: 3500,
      quantity: 1,
      supplements: [],
    },
  ],
  total: 3500,
};

function makeRequest() {
  return new NextRequest('http://localhost/api/commandes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': '1.2.3.4',
    },
    body: JSON.stringify(validBody),
  });
}

describe('POST /api/commandes — rate limiting', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renvoie 429/RATE_LIMITED après un nombre excessif de tentatives depuis la même IP', async () => {
    let lastStatus = 0;
    let lastJson: unknown;
    for (let i = 0; i < 10; i++) {
      const res = await POST(makeRequest());
      lastStatus = res.status;
      lastJson = await res.json();
    }

    expect(lastStatus).toBe(429);
    expect(lastJson).toMatchObject({ code: 'RATE_LIMITED' });
  });
});
