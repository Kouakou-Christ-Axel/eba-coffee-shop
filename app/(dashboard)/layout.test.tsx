// app/(dashboard)/layout.test.tsx
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

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) =>
    React.createElement('a', { href }, children),
}));

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

import { auth } from '@/lib/auth';
import DashboardLayout from './layout';

const mockGetSession = auth.api.getSession as MockedFunction<
  typeof auth.api.getSession
>;

describe('DashboardLayout', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('redirige vers /login si pas de session', async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(
      DashboardLayout({ children: React.createElement('div') })
    ).rejects.toThrow('REDIRECT:/login');
  });

  it('redirige vers / si session avec rôle USER', async () => {
    mockGetSession.mockResolvedValue({
      user: { role: 'USER', id: 'u1', email: 'user@test.com' },
      session: {},
    } as never);
    await expect(
      DashboardLayout({ children: React.createElement('div') })
    ).rejects.toThrow('REDIRECT:/');
  });

  it('affiche le layout avec sidebar si session ADMIN', async () => {
    mockGetSession.mockResolvedValue({
      user: { role: 'ADMIN', id: 'u1', email: 'admin@eba.ci' },
      session: {},
    } as never);
    const element = await DashboardLayout({
      children: React.createElement('p', null, 'contenu-test'),
    });
    const html = renderToStaticMarkup(element);
    expect(html).toContain('/dashboard/commandes');
    expect(html).toContain('/dashboard/menu');
    expect(html).toContain('contenu-test');
  });
});
