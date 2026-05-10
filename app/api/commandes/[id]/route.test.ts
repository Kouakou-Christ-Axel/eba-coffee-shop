// app/api/commandes/[id]/route.test.ts
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
      findUnique: vi.fn(),
    },
  },
}));

import prisma from '@/lib/prisma';
import { GET } from './route';

const mockFindUnique = prisma.order.findUnique as MockedFunction<
  typeof prisma.order.findUnique
>;

const mockOrder = {
  id: 'clorder123',
  reference: 'EBA-20260510-AB12',
  customerName: 'Kofi',
  customerPhone: '07001234',
  pickupTime: new Date('2026-05-10T14:30:00.000Z'),
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
  status: 'PENDING' as const,
  note: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeRequest(id: string) {
  return new NextRequest(`http://localhost/api/commandes/${id}`);
}

describe('GET /api/commandes/[id]', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('retourne 200 avec la commande si elle existe', async () => {
    mockFindUnique.mockResolvedValue(mockOrder);

    const res = await GET(makeRequest('clorder123'), {
      params: Promise.resolve({ id: 'clorder123' }),
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.id).toBe('clorder123');
    expect(json.reference).toBe('EBA-20260510-AB12');
    expect(json.customerName).toBe('Kofi');
  });

  it("retourne 404 si la commande n'existe pas", async () => {
    mockFindUnique.mockResolvedValue(null);

    const res = await GET(makeRequest('inexistant'), {
      params: Promise.resolve({ id: 'inexistant' }),
    });

    expect(res.status).toBe(404);
  });

  it('appelle prisma avec le bon id', async () => {
    mockFindUnique.mockResolvedValue(mockOrder);

    await GET(makeRequest('clorder123'), {
      params: Promise.resolve({ id: 'clorder123' }),
    });

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: 'clorder123' },
    });
  });
});
