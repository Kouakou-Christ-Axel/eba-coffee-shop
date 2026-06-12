# F5 — Dashboard Auth Admin — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Protéger le dashboard avec Better Auth (rôle ADMIN), créer la page de login Google, et promouvoir automatiquement un email admin au rôle ADMIN lors de sa première connexion.

**Architecture:** Le layout `app/(dashboard)/layout.tsx` vérifie la session côté serveur et redirige les non-authentifiés ou les non-admins. La promotion admin se fait via `databaseHooks.user.create.after` dans Better Auth — au premier login OAuth, si l'email correspond à `ADMIN_EMAIL`, le rôle est mis à jour en base. La page `/login` redirige les utilisateurs déjà connectés.

**Tech Stack:** Better Auth v1.5.5, Prisma (PostgreSQL), Next.js 16 App Router Server Components, React 19, Vitest, `react-dom/server` pour les tests.

---

## Fichiers créés/modifiés

| Fichier                               | Action   | Rôle                                                 |
| ------------------------------------- | -------- | ---------------------------------------------------- |
| `prisma/schema.prisma`                | Modifier | Ajouter `UserRole` enum + champ `role` sur `User`    |
| `.env.schema`                         | Modifier | Ajouter `ADMIN_EMAIL`                                |
| `lib/auth.ts`                         | Modifier | Exporter `promoteAdminIfMatch` + `databaseHooks`     |
| `lib/auth.test.ts`                    | Créer    | Tests de `promoteAdminIfMatch`                       |
| `app/(public)/login/login-button.tsx` | Créer    | Composant client — bouton Google                     |
| `app/(public)/login/page.tsx`         | Créer    | Page login (server component) — redirect si connecté |
| `app/(public)/login/page.test.tsx`    | Créer    | Tests de la page login                               |
| `app/(dashboard)/layout.tsx`          | Créer    | Layout dashboard — vérifie session + sidebar         |
| `app/(dashboard)/layout.test.tsx`     | Créer    | Tests des redirections du layout                     |
| `app/(dashboard)/dashboard/page.tsx`  | Créer    | Page d'accueil dashboard minimale                    |

---

## Task 1 — Schéma Prisma : UserRole

**Files:**

- Modify: `prisma/schema.prisma`

- [ ] **Step 1 : Ajouter l'enum et le champ role**

Dans `prisma/schema.prisma`, ajouter l'enum avant les autres enums et ajouter `role` au modèle `User` :

```prisma
enum UserRole {
  USER
  ADMIN
}

model User {
  id    String  @id @default(uuid())
  email String  @unique
  name  String?
  role  UserRole @default(USER)   // ← ligne ajoutée

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  emailVerified Boolean   @default(false)
  image         String?
  sessions      Session[]
  accounts      Account[]

  @@map("user")
}
```

- [ ] **Step 2 : Synchroniser la DB et régénérer le client**

```bash
bun run db:push
bun run db:generate
```

Résultat attendu : `✓ Your database is now in sync with your Prisma schema.`

- [ ] **Step 3 : Commit**

```bash
rtk git add prisma/schema.prisma generated/
rtk git commit -m "feat: add UserRole enum and role field to User model"
```

---

## Task 2 — Env : ADMIN_EMAIL

**Files:**

- Modify: `.env.schema`

- [ ] **Step 1 : Ajouter ADMIN_EMAIL à .env.schema**

```
# @type=string
ADMIN_EMAIL=
```

Ajouter à la fin du fichier `.env.schema`.

- [ ] **Step 2 : Commit**

```bash
rtk git add .env.schema
rtk git commit -m "feat: add ADMIN_EMAIL to env schema"
```

> Note : `env.d.ts` est autogénéré par varlock. `process.env.ADMIN_EMAIL` fonctionne sans régénération immédiate (ProcessEnv accepte string par défaut).

---

## Task 3 — Auth hook : promoteAdminIfMatch (TDD)

**Files:**

- Modify: `lib/auth.ts`
- Create: `lib/auth.test.ts`

- [ ] **Step 1 : Écrire les tests**

Créer `lib/auth.test.ts` :

```ts
// lib/auth.test.ts
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type MockedFunction,
} from 'vitest';

vi.mock('better-auth', () => ({
  betterAuth: vi.fn().mockReturnValue({ api: {} }),
}));

vi.mock('better-auth/adapters/prisma', () => ({
  prismaAdapter: vi.fn(),
}));

vi.mock('better-auth/next-js', () => ({
  nextCookies: vi.fn().mockReturnValue({}),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    user: {
      update: vi.fn(),
    },
  },
}));

import prisma from '@/lib/prisma';
import { promoteAdminIfMatch } from './auth';

const mockUpdate = prisma.user.update as MockedFunction<
  typeof prisma.user.update
>;

describe('promoteAdminIfMatch', () => {
  const savedAdminEmail = process.env.ADMIN_EMAIL;

  beforeEach(() => {
    vi.resetAllMocks();
    process.env.ADMIN_EMAIL = 'admin@eba.ci';
  });

  afterEach(() => {
    process.env.ADMIN_EMAIL = savedAdminEmail;
  });

  it("attribue le rôle ADMIN si l'email correspond à ADMIN_EMAIL", async () => {
    await promoteAdminIfMatch({ id: 'u1', email: 'admin@eba.ci' });
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { role: 'ADMIN' },
    });
  });

  it("n'appelle pas prisma si l'email ne correspond pas", async () => {
    await promoteAdminIfMatch({ id: 'u2', email: 'autre@test.com' });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("n'appelle pas prisma si ADMIN_EMAIL n'est pas défini", async () => {
    delete process.env.ADMIN_EMAIL;
    await promoteAdminIfMatch({ id: 'u3', email: 'admin@eba.ci' });
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```bash
rtk vitest run lib/auth.test.ts
```

Résultat attendu : FAIL — `promoteAdminIfMatch` n'est pas encore exportée.

- [ ] **Step 3 : Implémenter**

Remplacer le contenu de `lib/auth.ts` :

```ts
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import prisma from '@/lib/prisma';
import { nextCookies } from 'better-auth/next-js';

export async function promoteAdminIfMatch(user: { id: string; email: string }) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail && user.email === adminEmail) {
    await prisma.user.update({
      where: { id: user.id },
      data: { role: 'ADMIN' },
    });
  }
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  plugins: [nextCookies()],
  databaseHooks: {
    user: {
      create: {
        after: promoteAdminIfMatch,
      },
    },
  },
});
```

- [ ] **Step 4 : Vérifier que les tests passent**

```bash
rtk vitest run lib/auth.test.ts
```

Résultat attendu : PASS (3 tests).

- [ ] **Step 5 : Commit**

```bash
rtk git add lib/auth.ts lib/auth.test.ts
rtk git commit -m "feat: export promoteAdminIfMatch and wire databaseHooks in Better Auth"
```

---

## Task 4 — Dashboard layout (TDD)

**Files:**

- Create: `app/(dashboard)/layout.tsx`
- Create: `app/(dashboard)/layout.test.tsx`

- [ ] **Step 1 : Écrire les tests**

Créer `app/(dashboard)/layout.test.tsx` :

```tsx
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
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```bash
rtk vitest run "app/(dashboard)/layout.test.tsx"
```

Résultat attendu : FAIL — module not found.

- [ ] **Step 3 : Créer le layout**

Créer `app/(dashboard)/layout.tsx` :

```tsx
import React from 'react';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import { auth } from '@/lib/auth';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect('/login');
  }

  if ((session.user as { role: string }).role !== 'ADMIN') {
    redirect('/');
  }

  return (
    <div className="flex min-h-screen">
      <nav className="w-56 border-r bg-white p-6">
        <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">
          Dashboard
        </p>
        <ul className="space-y-2">
          <li>
            <Link
              href="/dashboard/commandes"
              className="block rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Commandes
            </Link>
          </li>
          <li>
            <Link
              href="/dashboard/menu"
              className="block rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Menu
            </Link>
          </li>
        </ul>
      </nav>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
```

- [ ] **Step 4 : Vérifier que les tests passent**

```bash
rtk vitest run "app/(dashboard)/layout.test.tsx"
```

Résultat attendu : PASS (3 tests).

- [ ] **Step 5 : Commit**

```bash
rtk git add "app/(dashboard)/layout.tsx" "app/(dashboard)/layout.test.tsx"
rtk git commit -m "feat: add dashboard layout with session guard (admin only)"
```

---

## Task 5 — Page login (TDD)

**Files:**

- Create: `app/(public)/login/login-button.tsx`
- Create: `app/(public)/login/page.tsx`
- Create: `app/(public)/login/page.test.tsx`

- [ ] **Step 1 : Écrire les tests de la page login**

Créer `app/(public)/login/page.test.tsx` :

```tsx
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
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```bash
rtk vitest run "app/(public)/login/page.test.tsx"
```

Résultat attendu : FAIL — module not found.

- [ ] **Step 3 : Créer le bouton client**

Créer `app/(public)/login/login-button.tsx` :

```tsx
'use client';
import { authClient } from '@/lib/auth-client';

export default function LoginButton() {
  return (
    <button
      onClick={() =>
        authClient.signIn.social({
          provider: 'google',
          callbackURL: '/dashboard',
        })
      }
      className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-6 py-3 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
    >
      Se connecter avec Google
    </button>
  );
}
```

- [ ] **Step 4 : Créer la page login**

Créer `app/(public)/login/page.tsx` :

```tsx
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import LoginButton from './login-button';

export default async function LoginPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (session) {
    redirect('/dashboard');
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">
          EBA Coffee Shop
        </h1>
        <p className="mb-8 text-sm text-gray-500">
          Accès réservé aux administrateurs
        </p>
        <LoginButton />
      </div>
    </main>
  );
}
```

- [ ] **Step 5 : Vérifier que les tests passent**

```bash
rtk vitest run "app/(public)/login/page.test.tsx"
```

Résultat attendu : PASS (2 tests).

- [ ] **Step 6 : Commit**

```bash
rtk git add "app/(public)/login/"
rtk git commit -m "feat: add login page with Google OAuth redirect guard"
```

---

## Task 6 — Page d'accueil dashboard minimale

**Files:**

- Create: `app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1 : Créer la page**

Créer `app/(dashboard)/dashboard/page.tsx` :

```tsx
export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">
        Bienvenue sur le dashboard EBA Coffee Shop
      </h1>
      <p className="mt-2 text-sm text-gray-500">
        Sélectionnez une section dans le menu à gauche.
      </p>
    </div>
  );
}
```

- [ ] **Step 2 : Vérifier que tous les tests passent**

```bash
rtk vitest run
```

Résultat attendu : PASS — tous les tests existants + nouveaux.

- [ ] **Step 3 : Commit final**

```bash
rtk git add "app/(dashboard)/dashboard/page.tsx"
rtk git commit -m "feat: add minimal dashboard home page"
```

---

## Vérification de couverture spec

| Test spec F5                                                | Couvert par                                        |
| ----------------------------------------------------------- | -------------------------------------------------- |
| `GET /dashboard` sans session → redirect `/login`           | Task 4 — layout test                               |
| `GET /dashboard` avec session `USER` → redirect `/`         | Task 4 — layout test                               |
| `GET /dashboard` avec session `ADMIN` → 200                 | Task 4 — layout test                               |
| `GET /login` avec session existante → redirect `/dashboard` | Task 5 — login page test                           |
| Email = `ADMIN_EMAIL` → rôle `ADMIN` après login            | Task 3 — auth.test.ts                              |
| Email différent → rôle `USER` (défaut Prisma)               | Task 3 — "n'appelle pas prisma si email différent" |
