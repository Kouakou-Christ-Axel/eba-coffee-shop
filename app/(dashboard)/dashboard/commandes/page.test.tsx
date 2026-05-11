// app/(dashboard)/dashboard/commandes/page.test.tsx
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

vi.mock('@/lib/orders', () => ({
  listOrders: vi.fn(),
}));

vi.mock('./status-tabs', () => ({
  StatusTabs: ({ activeStatus }: { activeStatus?: string }) =>
    React.createElement('div', { 'data-active': activeStatus ?? 'all' }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) =>
    React.createElement('a', { href }, children),
}));

import { listOrders } from '@/lib/orders';
import CommandesPage from './page';

const mockListOrders = listOrders as MockedFunction<typeof listOrders>;

const mockOrder = {
  id: 'o1',
  reference: 'EBA-20260511-AB12',
  customerName: 'Kofi',
  customerPhone: '07001234',
  pickupTime: new Date('2026-05-11T14:30:00'),
  items: [{ productName: 'Café', quantity: 1 }],
  total: 3500,
  status: 'PENDING' as const,
  note: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('CommandesPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('affiche les commandes dans le tableau', async () => {
    mockListOrders.mockResolvedValue({
      orders: [mockOrder],
      total: 1,
      pageSize: 20,
    });

    const element = await CommandesPage({
      searchParams: Promise.resolve({}),
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain('EBA-20260511-AB12');
    expect(html).toContain('Kofi');
    expect(html).toContain('07001234');
  });

  it('appelle listOrders avec le filtre status depuis searchParams', async () => {
    mockListOrders.mockResolvedValue({ orders: [], total: 0, pageSize: 20 });

    await CommandesPage({
      searchParams: Promise.resolve({ status: 'PENDING' }),
    });

    expect(mockListOrders).toHaveBeenCalledWith({ page: 1, status: 'PENDING' });
  });

  it('affiche le lien Suivant si plus de 20 commandes', async () => {
    mockListOrders.mockResolvedValue({
      orders: [mockOrder],
      total: 45,
      pageSize: 20,
    });

    const element = await CommandesPage({
      searchParams: Promise.resolve({}),
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain('Suivant');
  });

  it("n'affiche pas la pagination si une seule page", async () => {
    mockListOrders.mockResolvedValue({
      orders: [mockOrder],
      total: 5,
      pageSize: 20,
    });

    const element = await CommandesPage({
      searchParams: Promise.resolve({}),
    });
    const html = renderToStaticMarkup(element);

    expect(html).not.toContain('Suivant');
    expect(html).not.toContain('Précédent');
  });

  it('affiche le lien Précédent depuis la page 2', async () => {
    mockListOrders.mockResolvedValue({
      orders: [mockOrder],
      total: 45,
      pageSize: 20,
    });

    const element = await CommandesPage({
      searchParams: Promise.resolve({ page: '2' }),
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain('Précédent');
  });
});
