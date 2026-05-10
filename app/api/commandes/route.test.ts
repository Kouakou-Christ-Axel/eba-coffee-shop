// app/api/commandes/route.test.ts
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  type MockedFunction,
} from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  default: {
    order: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/email', () => ({
  sendNewOrderEmail: vi.fn().mockResolvedValue(undefined),
}));

import prisma from '@/lib/prisma';
import { sendNewOrderEmail } from '@/lib/email';
import { POST } from './route';

const mockCreate = prisma.order.create as MockedFunction<
  typeof prisma.order.create
>;
const mockFindUnique = prisma.order.findUnique as MockedFunction<
  typeof prisma.order.findUnique
>;
const mockSendNewOrderEmail = sendNewOrderEmail as MockedFunction<
  typeof sendNewOrderEmail
>;

const validBody = {
  customerName: 'Kofi',
  customerPhone: '07001234',
  pickupTime: new Date(Date.now() + 3_600_000).toISOString(),
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

const mockOrder = {
  id: 'clorder123',
  reference: 'EBA-20260510-AB12',
  customerName: validBody.customerName,
  customerPhone: validBody.customerPhone,
  pickupTime: new Date(validBody.pickupTime),
  items: validBody.items,
  total: validBody.total,
  status: 'PENDING' as const,
  note: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/commandes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/commandes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockSendNewOrderEmail.mockResolvedValue(undefined);
  });

  it('retourne 201 avec id et reference pour un body valide', async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue(mockOrder);

    const res = await POST(makeRequest(validBody));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json).toHaveProperty('id', 'clorder123');
    expect(json).toHaveProperty('reference', 'EBA-20260510-AB12');
  });

  it('retourne 400 si items est vide', async () => {
    const res = await POST(makeRequest({ ...validBody, items: [] }));
    expect(res.status).toBe(400);
  });

  it('retourne 400 si customerPhone trop court', async () => {
    const res = await POST(makeRequest({ ...validBody, customerPhone: '071' }));
    expect(res.status).toBe(400);
  });

  it('retourne 400 si total négatif', async () => {
    const res = await POST(makeRequest({ ...validBody, total: -1 }));
    expect(res.status).toBe(400);
  });

  it('retourne 400 si pickupTime invalide', async () => {
    const res = await POST(
      makeRequest({ ...validBody, pickupTime: 'pas-une-date' })
    );
    expect(res.status).toBe(400);
  });

  it("retourne 400 si body n'est pas du JSON valide", async () => {
    const req = new NextRequest('http://localhost/api/commandes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'pas du json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('retourne 500 si prisma échoue', async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockRejectedValue(new Error('DB error'));

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(500);
  });

  it("l'échec de l'envoi email ne cause pas un 500", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue(mockOrder);
    mockSendNewOrderEmail.mockRejectedValue(new Error('Resend error'));

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(201);
  });
});
