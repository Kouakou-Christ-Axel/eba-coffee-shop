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
  default: () =>
    React.createElement('button', null, 'Se connecter avec Google'),
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

  it('affiche le bouton Google si pas de session', async () => {
    mockGetSession.mockResolvedValue(null);
    const element = await LoginPage();
    const html = renderToStaticMarkup(element);
    expect(html).toContain('Se connecter avec Google');
  });
});
