// lib/orders.test.ts
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  type MockedFunction,
} from 'vitest';

// Mock prisma AVANT tout import qui l'utilise
vi.mock('@/lib/prisma', () => ({
  default: {
    order: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

import prisma from '@/lib/prisma';

// Type the mocked functions explicitly
const mockCreate = prisma.order.create as MockedFunction<
  typeof prisma.order.create
>;
const mockFindUnique = prisma.order.findUnique as MockedFunction<
  typeof prisma.order.findUnique
>;

import {
  generateOrderReference,
  createOrderSchema,
  createOrder,
  getOrder,
} from './orders';

// ─── generateOrderReference ───────────────────────────────────────────────────

describe('generateOrderReference', () => {
  it('suit le format EBA-YYYYMMDD-[A-Z0-9]{4}', () => {
    const ref = generateOrderReference();
    expect(ref).toMatch(/^EBA-\d{8}-[A-Z0-9]{4}$/);
  });

  it('contient la date du jour', () => {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const ref = generateOrderReference();
    expect(ref).toContain(`EBA-${today}-`);
  });

  it('génère des références différentes à chaque appel', () => {
    const refs = new Set(Array.from({ length: 20 }, generateOrderReference));
    expect(refs.size).toBeGreaterThan(1);
  });
});

// ─── createOrderSchema ────────────────────────────────────────────────────────

const validInput = {
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

describe('createOrderSchema', () => {
  it('accepte un body valide', () => {
    expect(createOrderSchema.safeParse(validInput).success).toBe(true);
  });

  it('rejette items vide', () => {
    expect(
      createOrderSchema.safeParse({ ...validInput, items: [] }).success
    ).toBe(false);
  });

  it('rejette customerPhone trop court (< 8 chars)', () => {
    expect(
      createOrderSchema.safeParse({ ...validInput, customerPhone: '071234' })
        .success
    ).toBe(false);
  });

  it('rejette total négatif', () => {
    expect(
      createOrderSchema.safeParse({ ...validInput, total: -100 }).success
    ).toBe(false);
  });

  it('rejette total zéro', () => {
    expect(
      createOrderSchema.safeParse({ ...validInput, total: 0 }).success
    ).toBe(false);
  });

  it('rejette pickupTime non-ISO', () => {
    expect(
      createOrderSchema.safeParse({ ...validInput, pickupTime: 'pas-une-date' })
        .success
    ).toBe(false);
  });

  it('rejette customerName trop court (< 2 chars)', () => {
    expect(
      createOrderSchema.safeParse({ ...validInput, customerName: 'K' }).success
    ).toBe(false);
  });
});

// ─── createOrder ──────────────────────────────────────────────────────────────

describe('createOrder', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('crée la commande avec le statut PENDING par défaut', async () => {
    const mockOrder = {
      id: 'clorder123',
      reference: 'EBA-20260510-AB12',
      customerName: validInput.customerName,
      customerPhone: validInput.customerPhone,
      pickupTime: new Date(validInput.pickupTime),
      items: validInput.items,
      total: validInput.total,
      status: 'PENDING' as const,
      note: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue(mockOrder);

    const result = await createOrder(validInput);

    expect(mockCreate).toHaveBeenCalledOnce();
    expect(result.status).toBe('PENDING');
    expect(result.reference).toBe('EBA-20260510-AB12');
  });

  it('passe les bonnes données à prisma.order.create', async () => {
    const mockOrder = {
      id: 'clorder123',
      reference: 'EBA-20260510-AB12',
      customerName: validInput.customerName,
      customerPhone: validInput.customerPhone,
      pickupTime: new Date(validInput.pickupTime),
      items: validInput.items,
      total: validInput.total,
      status: 'PENDING' as const,
      note: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue(mockOrder);

    await createOrder(validInput);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customerName: 'Kofi',
          customerPhone: '07001234',
          total: 3500,
        }),
      })
    );
  });
});

// ─── getOrder ─────────────────────────────────────────────────────────────────

describe('getOrder', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('retourne la commande si elle existe', async () => {
    const mockOrder = {
      id: 'clorder123',
      reference: 'EBA-20260510-AB12',
      customerName: 'Kofi',
      customerPhone: '07001234',
      pickupTime: new Date(),
      items: [],
      total: 3500,
      status: 'PENDING' as const,
      note: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockFindUnique.mockResolvedValue(mockOrder);

    const result = await getOrder('clorder123');
    expect(result).toEqual(mockOrder);
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: 'clorder123' },
    });
  });

  it("retourne null si la commande n'existe pas", async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await getOrder('inexistant');
    expect(result).toBeNull();
  });
});
