// app/(public)/login/page.test.tsx
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

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

// Évite l'import de authClient (client-only) dans le contexte node
vi.mock('./login-button', () => ({
  default: ({ redirectTo }: { redirectTo?: string }) =>
    React.createElement(
      'form',
      null,
      React.createElement(
        'button',
        { 'data-redirect': redirectTo },
        'Recevoir un code'
      )
    ),
}));

import { auth } from '@/lib/auth';
import LoginPage from './page';

const mockGetSession = auth.api.getSession as MockedFunction<
  typeof auth.api.getSession
>;

describe('LoginPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('redirige vers /dashboard si déjà connecté', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'u1', email: 'admin@eba.ci', role: 'ADMIN' },
      session: {},
    } as never);
    await expect(LoginPage()).rejects.toThrow('REDIRECT:/dashboard');
  });

  it('reprend le flux OAuth MCP après connexion (session existante)', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'u1', email: 'admin@eba.ci', role: 'ADMIN' },
      session: {},
    } as never);
    const searchParams = Promise.resolve({
      client_id: 'abc',
      response_type: 'code',
      redirect_uri: 'https://claude.ai/cb',
      state: 'xyz',
    });
    await expect(LoginPage({ searchParams })).rejects.toThrow(
      /REDIRECT:\/api\/auth\/mcp\/authorize\?/
    );
  });

  it('affiche le formulaire de connexion OTP si pas de session', async () => {
    mockGetSession.mockResolvedValue(null);
    const element = await LoginPage();
    const html = renderToStaticMarkup(element);
    expect(html).toContain('Recevoir un code');
  });
});
