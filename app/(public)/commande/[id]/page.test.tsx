// app/(public)/commande/[id]/page.test.tsx
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  type MockedFunction,
} from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('@/lib/prisma', () => ({
  default: {
    order: {
      findUnique: vi.fn(),
    },
    pickupSettings: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
}));

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => React.createElement('a', { href, ...props }, children),
}));

import prisma from '@/lib/prisma';
import Page, { metadata } from './page';

const mockFindUnique = prisma.order.findUnique as MockedFunction<
  typeof prisma.order.findUnique
>;

const mockOrder = {
  id: 'clorder123',
  reference: 'EBA-20260510-AB12',
  customerName: 'Kofi',
  customerPhone: '07001234',
  pickupTime: new Date('2026-05-10T14:30:00'),
  items: [
    {
      cartId: 'abc',
      productId: 'prod-1',
      productName: 'Cappuccino',
      basePrice: 3500,
      quantity: 2,
      supplements: [
        { groupName: 'Lait', optionName: 'Lait de soja', price: 500 },
      ],
    },
  ],
  total: 8000,
  status: 'PENDING' as const,
  note: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('CommandePage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('affiche la référence correcte pour un id valide', async () => {
    mockFindUnique.mockResolvedValue(mockOrder);
    const element = await Page({
      params: Promise.resolve({ id: 'clorder123' }),
    });
    const html = renderToStaticMarkup(element);
    expect(html).toContain('EBA-20260510-AB12');
  });

  it('affiche le prénom et le téléphone du client', async () => {
    mockFindUnique.mockResolvedValue(mockOrder);
    const element = await Page({
      params: Promise.resolve({ id: 'clorder123' }),
    });
    const html = renderToStaticMarkup(element);
    expect(html).toContain('Kofi');
    expect(html).toContain('07001234');
  });

  it("affiche l'heure de retrait formatée", async () => {
    mockFindUnique.mockResolvedValue(mockOrder);
    const element = await Page({
      params: Promise.resolve({ id: 'clorder123' }),
    });
    const html = renderToStaticMarkup(element);
    expect(html).toMatch(/[A-Z][a-z]+ 10 mai · 14h30/);
  });

  it('affiche la liste des articles avec suppléments', async () => {
    mockFindUnique.mockResolvedValue(mockOrder);
    const element = await Page({
      params: Promise.resolve({ id: 'clorder123' }),
    });
    const html = renderToStaticMarkup(element);
    expect(html).toContain('Cappuccino');
    expect(html).toContain('Lait de soja');
    expect(html).toContain('x2');
  });

  it('affiche le total formaté en FCFA', async () => {
    mockFindUnique.mockResolvedValue(mockOrder);
    const element = await Page({
      params: Promise.resolve({ id: 'clorder123' }),
    });
    const html = renderToStaticMarkup(element);
    expect(html).toContain('FCFA');
    // Intl.NumberFormat('fr-FR').format(8000) → "8 000" (espace fine ou espace insécable)
    expect(html).toMatch(/8.000/);
  });

  it('retourne 404 pour un id inexistant', async () => {
    mockFindUnique.mockResolvedValue(null);
    await expect(
      Page({ params: Promise.resolve({ id: 'inexistant' }) })
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });
});

describe('metadata', () => {
  it('a le titre "Commande confirmée — EBA Coffee Shop"', () => {
    expect(metadata.title).toBe('Commande confirmée — EBA Coffee Shop');
  });

  it('a les meta robots noindex', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
