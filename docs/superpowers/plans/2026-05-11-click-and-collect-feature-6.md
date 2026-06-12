# F6 — Dashboard Gestion des commandes — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Créer la vue liste et la vue détail des commandes dans le dashboard admin, avec filtrage par statut, pagination, et boutons d'action pour changer le statut d'une commande via Server Actions.

**Architecture:** La vue liste est un Server Component qui appelle `listOrders` (lib/orders.ts) avec les query params `?page=N&status=X`. Les tabs de filtre sont un Client Component séparé (StatusTabs) pour la navigation URL. Les boutons d'action sont un Client Component séparé (StatusButtons) qui appelle le Server Action `updateOrderStatus`. Le Server Action vérifie la session admin et valide la transition de statut avant d'écrire en base.

**Tech Stack:** Next.js 16 App Router Server Components + Server Actions, Prisma, Shadcn/ui (Table, Tabs, Badge, Button, Card, Separator), Vitest + `renderToStaticMarkup`, `lib/cart-store.ts` pour les types CartItem.

---

## Fichiers créés/modifiés

| Fichier                                                            | Action   | Rôle                                                                  |
| ------------------------------------------------------------------ | -------- | --------------------------------------------------------------------- |
| `lib/orders.ts`                                                    | Modifier | Ajouter `listOrders({ page, status })` et exporter `ListOrdersParams` |
| `lib/orders.test.ts`                                               | Créer    | Tests TDD de `listOrders`                                             |
| `app/(dashboard)/dashboard/commandes/actions.ts`                   | Créer    | Server Action `updateOrderStatus` — auth + transition validation      |
| `app/(dashboard)/dashboard/commandes/actions.test.ts`              | Créer    | Tests TDD de `updateOrderStatus`                                      |
| `app/(dashboard)/dashboard/commandes/status-tabs.tsx`              | Créer    | Client Component — tabs de filtre par statut                          |
| `app/(dashboard)/dashboard/commandes/page.tsx`                     | Créer    | Server Component — liste des commandes                                |
| `app/(dashboard)/dashboard/commandes/page.test.tsx`                | Créer    | Tests TDD de la page liste                                            |
| `app/(dashboard)/dashboard/commandes/[id]/status-buttons.tsx`      | Créer    | Client Component — boutons d'action selon statut                      |
| `app/(dashboard)/dashboard/commandes/[id]/status-buttons.test.tsx` | Créer    | Tests TDD de StatusButtons                                            |
| `app/(dashboard)/dashboard/commandes/[id]/page.tsx`                | Créer    | Server Component — détail d'une commande                              |
| `app/(dashboard)/dashboard/commandes/[id]/page.test.tsx`           | Créer    | Tests TDD de la page détail                                           |

---

## Task 1 — Composants Shadcn : table, tabs, badge

**Files:**

- Creates: `components/ui/table.tsx`, `components/ui/tabs.tsx`, `components/ui/badge.tsx`

- [ ] **Step 1 : Installer les composants**

```bash
bunx --bun shadcn@latest add table tabs badge -y
```

- [ ] **Step 2 : Vérifier les fichiers créés**

```bash
rtk git status
```

Résultat attendu : 3 nouveaux fichiers dans `components/ui/`.

- [ ] **Step 3 : Commit**

```bash
rtk git add components/ui/table.tsx components/ui/tabs.tsx components/ui/badge.tsx
rtk git commit -m "feat: add Shadcn table, tabs, badge components"
```

---

## Task 2 — `listOrders` dans lib/orders.ts (TDD)

**Files:**

- Modify: `lib/orders.ts`
- Create: `lib/orders.test.ts`

- [ ] **Step 1 : Écrire les tests**

Créer `lib/orders.test.ts` :

```ts
// lib/orders.test.ts
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  type MockedFunction,
} from 'vitest';

vi.mock('@/lib/prisma', () => ({
  default: {
    order: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import prisma from '@/lib/prisma';
import { listOrders } from './orders';

const mockFindMany = prisma.order.findMany as MockedFunction<
  typeof prisma.order.findMany
>;
const mockCount = prisma.order.count as MockedFunction<
  typeof prisma.order.count
>;

const mockOrder = {
  id: 'o1',
  reference: 'EBA-20260511-AB12',
  customerName: 'Kofi',
  customerPhone: '07001234',
  pickupTime: new Date(),
  items: [],
  total: 3500,
  status: 'PENDING' as const,
  note: null,
  createdAt: new Date('2026-05-11T10:00:00'),
  updatedAt: new Date(),
};

describe('listOrders', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('retourne les commandes et les passe triées par createdAt DESC', async () => {
    mockFindMany.mockResolvedValue([mockOrder]);
    mockCount.mockResolvedValue(1);

    const result = await listOrders({ page: 1 });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' } })
    );
    expect(result.orders).toEqual([mockOrder]);
  });

  it('passe le filtre status quand fourni', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await listOrders({ page: 1, status: 'PENDING' });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'PENDING' } })
    );
    expect(mockCount).toHaveBeenCalledWith({ where: { status: 'PENDING' } });
  });

  it('sans filtre, passe un where vide', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await listOrders({ page: 1 });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    );
  });

  it('limite à 20 résultats par page (take: 20)', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await listOrders({ page: 1 });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20 })
    );
  });

  it('calcule le skip correct pour la page 2 (skip: 20)', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await listOrders({ page: 2 });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20 })
    );
  });

  it('retourne total et pageSize', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(45);

    const result = await listOrders({ page: 1 });

    expect(result.total).toBe(45);
    expect(result.pageSize).toBe(20);
  });
});
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```bash
rtk vitest run lib/orders.test.ts
```

Résultat attendu : FAIL — `listOrders` n'est pas encore exportée.

- [ ] **Step 3 : Ajouter `listOrders` à lib/orders.ts**

Ajouter à la fin de `lib/orders.ts` (après la fonction `getOrder` existante) :

```ts
import type { OrderStatus } from '@/generated/prisma';

export interface ListOrdersParams {
  page: number;
  status?: OrderStatus;
}

export async function listOrders({ page, status }: ListOrdersParams) {
  const pageSize = 20;
  const skip = (page - 1) * pageSize;
  const where = status ? { status } : {};

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.order.count({ where }),
  ]);

  return { orders, total, pageSize };
}
```

Ajouter aussi l'import `OrderStatus` en haut du fichier (avec les autres imports Prisma si présents, sinon ajouter) :

```ts
import type { OrderStatus } from '@/generated/prisma';
```

- [ ] **Step 4 : Vérifier que les tests passent**

```bash
rtk vitest run lib/orders.test.ts
```

Résultat attendu : PASS (6 tests).

- [ ] **Step 5 : Commit**

```bash
rtk git add lib/orders.ts lib/orders.test.ts
rtk git commit -m "feat: add listOrders with pagination and status filter"
```

---

## Task 3 — Server Action `updateOrderStatus` (TDD)

**Files:**

- Create: `app/(dashboard)/dashboard/commandes/actions.ts`
- Create: `app/(dashboard)/dashboard/commandes/actions.test.ts`

- [ ] **Step 1 : Écrire les tests**

Créer `app/(dashboard)/dashboard/commandes/actions.test.ts` :

```ts
// app/(dashboard)/dashboard/commandes/actions.test.ts
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  type MockedFunction,
} from 'vitest';

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

vi.mock('@/lib/prisma', () => ({
  default: {
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { updateOrderStatus } from './actions';

const mockGetSession = auth.api.getSession as MockedFunction<
  typeof auth.api.getSession
>;
const mockFindUnique = prisma.order.findUnique as MockedFunction<
  typeof prisma.order.findUnique
>;
const mockUpdate = prisma.order.update as MockedFunction<
  typeof prisma.order.update
>;

const adminSession = {
  user: { role: 'ADMIN', id: 'u1', email: 'admin@eba.ci' },
  session: {},
} as never;

describe('updateOrderStatus', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('met à jour le statut pour une transition valide (PENDING → CONFIRMED)', async () => {
    mockGetSession.mockResolvedValue(adminSession);
    mockFindUnique.mockResolvedValue({ id: 'o1', status: 'PENDING' } as never);
    mockUpdate.mockResolvedValue({} as never);

    await updateOrderStatus('o1', 'CONFIRMED');

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: { status: 'CONFIRMED' },
    });
  });

  it('lève une erreur si pas de session', async () => {
    mockGetSession.mockResolvedValue(null);

    await expect(updateOrderStatus('o1', 'CONFIRMED')).rejects.toThrow(
      'Non autorisé'
    );
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it('lève une erreur si rôle USER', async () => {
    mockGetSession.mockResolvedValue({
      user: { role: 'USER', id: 'u1' },
      session: {},
    } as never);

    await expect(updateOrderStatus('o1', 'CONFIRMED')).rejects.toThrow(
      'Non autorisé'
    );
  });

  it('lève une erreur pour transition invalide (PICKED_UP → PENDING)', async () => {
    mockGetSession.mockResolvedValue(adminSession);
    mockFindUnique.mockResolvedValue({
      id: 'o1',
      status: 'PICKED_UP',
    } as never);

    await expect(updateOrderStatus('o1', 'PENDING')).rejects.toThrow(
      'Transition invalide'
    );
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('lève une erreur pour transition invalide (CANCELLED → CONFIRMED)', async () => {
    mockGetSession.mockResolvedValue(adminSession);
    mockFindUnique.mockResolvedValue({
      id: 'o1',
      status: 'CANCELLED',
    } as never);

    await expect(updateOrderStatus('o1', 'CONFIRMED')).rejects.toThrow(
      'Transition invalide'
    );
  });

  it('autorise CONFIRMED → READY', async () => {
    mockGetSession.mockResolvedValue(adminSession);
    mockFindUnique.mockResolvedValue({
      id: 'o1',
      status: 'CONFIRMED',
    } as never);
    mockUpdate.mockResolvedValue({} as never);

    await updateOrderStatus('o1', 'READY');

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: { status: 'READY' },
    });
  });
});
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```bash
rtk vitest run "app/(dashboard)/dashboard/commandes/actions.test.ts"
```

Résultat attendu : FAIL — module not found.

- [ ] **Step 3 : Créer le Server Action**

Créer `app/(dashboard)/dashboard/commandes/actions.ts` :

```ts
'use server';

import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import type { OrderStatus } from '@/generated/prisma';

const VALID_TRANSITIONS: Record<string, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['READY', 'CANCELLED'],
  READY: ['PICKED_UP'],
  PICKED_UP: [],
  CANCELLED: [],
};

export async function updateOrderStatus(
  id: string,
  newStatus: OrderStatus
): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session || session.user.role !== 'ADMIN') {
    throw new Error('Non autorisé');
  }

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    throw new Error('Commande introuvable');
  }

  const allowed = VALID_TRANSITIONS[order.status] ?? [];
  if (!allowed.includes(newStatus)) {
    throw new Error(`Transition invalide : ${order.status} → ${newStatus}`);
  }

  await prisma.order.update({
    where: { id },
    data: { status: newStatus },
  });
}
```

- [ ] **Step 4 : Vérifier que les 6 tests passent**

```bash
rtk vitest run "app/(dashboard)/dashboard/commandes/actions.test.ts"
```

Résultat attendu : PASS (6 tests).

- [ ] **Step 5 : Commit**

```bash
rtk git add "app/(dashboard)/dashboard/commandes/actions.ts" "app/(dashboard)/dashboard/commandes/actions.test.ts"
rtk git commit -m "feat: add updateOrderStatus server action with auth and transition validation"
```

---

## Task 4 — Page liste des commandes (TDD)

**Files:**

- Create: `app/(dashboard)/dashboard/commandes/status-tabs.tsx`
- Create: `app/(dashboard)/dashboard/commandes/page.tsx`
- Create: `app/(dashboard)/dashboard/commandes/page.test.tsx`

- [ ] **Step 1 : Écrire les tests**

Créer `app/(dashboard)/dashboard/commandes/page.test.tsx` :

```tsx
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
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```bash
rtk vitest run "app/(dashboard)/dashboard/commandes/page.test.tsx"
```

Résultat attendu : FAIL — module not found.

- [ ] **Step 3 : Créer StatusTabs**

Créer `app/(dashboard)/dashboard/commandes/status-tabs.tsx` :

```tsx
'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const TABS = [
  { value: 'all', label: 'Toutes' },
  { value: 'PENDING', label: 'En attente' },
  { value: 'CONFIRMED', label: 'Confirmées' },
  { value: 'READY', label: 'Prêtes' },
  { value: 'PICKED_UP', label: 'Récupérées' },
  { value: 'CANCELLED', label: 'Annulées' },
];

export function StatusTabs({ activeStatus }: { activeStatus?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all') {
      params.delete('status');
    } else {
      params.set('status', value);
    }
    params.delete('page');
    router.push(`?${params.toString()}`);
  };

  return (
    <Tabs value={activeStatus ?? 'all'} onValueChange={handleChange}>
      <TabsList>
        {TABS.map(({ value, label }) => (
          <TabsTrigger key={value} value={value}>
            {label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
```

- [ ] **Step 4 : Créer la page liste**

Créer `app/(dashboard)/dashboard/commandes/page.tsx` :

```tsx
import { listOrders } from '@/lib/orders';
import type { OrderStatus } from '@/generated/prisma';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { StatusTabs } from './status-tabs';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmée',
  READY: 'Prête',
  PICKED_UP: 'Récupérée',
  CANCELLED: 'Annulée',
};

const STATUS_VARIANTS: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  PENDING: 'secondary',
  CONFIRMED: 'default',
  READY: 'default',
  PICKED_UP: 'outline',
  CANCELLED: 'destructive',
};

function formatPickupTime(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(date)
    .replace(':', 'h');
}

export default async function CommandesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1));
  const status = params.status as OrderStatus | undefined;

  const { orders, total, pageSize } = await listOrders({ page, status });
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Commandes</h1>
      <StatusTabs activeStatus={status} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Référence</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Téléphone</TableHead>
            <TableHead>Créneau</TableHead>
            <TableHead>Articles</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.id}>
              <TableCell className="font-mono text-sm">
                {order.reference}
              </TableCell>
              <TableCell>{order.customerName}</TableCell>
              <TableCell>{order.customerPhone}</TableCell>
              <TableCell>{formatPickupTime(order.pickupTime)}</TableCell>
              <TableCell>{(order.items as unknown[]).length}</TableCell>
              <TableCell>
                {new Intl.NumberFormat('fr-FR').format(order.total)} FCFA
              </TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANTS[order.status]}>
                  {STATUS_LABELS[order.status]}
                </Badge>
              </TableCell>
              <TableCell>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/dashboard/commandes/${order.id}`}>Voir</Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {totalPages > 1 && (
        <div className="flex items-center gap-3">
          {page > 1 && (
            <Button variant="outline" size="sm" asChild>
              <Link
                href={`?page=${page - 1}${status ? `&status=${status}` : ''}`}
              >
                Précédent
              </Link>
            </Button>
          )}
          <span className="text-sm text-muted-foreground">
            Page {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Button variant="outline" size="sm" asChild>
              <Link
                href={`?page=${page + 1}${status ? `&status=${status}` : ''}`}
              >
                Suivant
              </Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5 : Vérifier que les 5 tests passent**

```bash
rtk vitest run "app/(dashboard)/dashboard/commandes/page.test.tsx"
```

Résultat attendu : PASS (5 tests).

- [ ] **Step 6 : Commit**

```bash
rtk git add "app/(dashboard)/dashboard/commandes/status-tabs.tsx" "app/(dashboard)/dashboard/commandes/page.tsx" "app/(dashboard)/dashboard/commandes/page.test.tsx"
rtk git commit -m "feat: add commandes list page with status filter tabs and pagination"
```

---

## Task 5 — StatusButtons + Page détail (TDD)

**Files:**

- Create: `app/(dashboard)/dashboard/commandes/[id]/status-buttons.tsx`
- Create: `app/(dashboard)/dashboard/commandes/[id]/status-buttons.test.tsx`
- Create: `app/(dashboard)/dashboard/commandes/[id]/page.tsx`
- Create: `app/(dashboard)/dashboard/commandes/[id]/page.test.tsx`

- [ ] **Step 1 : Écrire les tests de StatusButtons**

Créer `app/(dashboard)/dashboard/commandes/[id]/status-buttons.test.tsx` :

```tsx
// app/(dashboard)/dashboard/commandes/[id]/status-buttons.test.tsx
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('../actions', () => ({
  updateOrderStatus: vi.fn(),
}));

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useTransition: () => [false, (fn: () => void) => fn()],
  };
});

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    disabled,
    variant,
  }: {
    children: React.ReactNode;
    disabled?: boolean;
    variant?: string;
  }) =>
    React.createElement(
      'button',
      { disabled, 'data-variant': variant },
      children
    ),
}));

import { StatusButtons } from './status-buttons';

describe('StatusButtons', () => {
  it('affiche Confirmer et Annuler pour PENDING', () => {
    const html = renderToStaticMarkup(
      React.createElement(StatusButtons, {
        orderId: 'o1',
        currentStatus: 'PENDING',
      })
    );
    expect(html).toContain('Confirmer');
    expect(html).toContain('Annuler');
  });

  it('affiche Marquer comme prête et Annuler pour CONFIRMED', () => {
    const html = renderToStaticMarkup(
      React.createElement(StatusButtons, {
        orderId: 'o1',
        currentStatus: 'CONFIRMED',
      })
    );
    expect(html).toContain('Marquer comme prête');
    expect(html).toContain('Annuler');
  });

  it('affiche uniquement Marquer comme récupérée pour READY', () => {
    const html = renderToStaticMarkup(
      React.createElement(StatusButtons, {
        orderId: 'o1',
        currentStatus: 'READY',
      })
    );
    expect(html).toContain('Marquer comme récupérée');
    expect(html).not.toContain('Annuler');
  });

  it('affiche rien pour PICKED_UP (lecture seule)', () => {
    const html = renderToStaticMarkup(
      React.createElement(StatusButtons, {
        orderId: 'o1',
        currentStatus: 'PICKED_UP',
      })
    );
    expect(html).toBe('');
  });

  it('affiche rien pour CANCELLED (lecture seule)', () => {
    const html = renderToStaticMarkup(
      React.createElement(StatusButtons, {
        orderId: 'o1',
        currentStatus: 'CANCELLED',
      })
    );
    expect(html).toBe('');
  });
});
```

- [ ] **Step 2 : Écrire les tests de la page détail**

Créer `app/(dashboard)/dashboard/commandes/[id]/page.test.tsx` :

```tsx
// app/(dashboard)/dashboard/commandes/[id]/page.test.tsx
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
  getOrder: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) =>
    React.createElement('a', { href }, children),
}));

vi.mock('./status-buttons', () => ({
  StatusButtons: ({ currentStatus }: { currentStatus: string }) =>
    React.createElement('div', { 'data-status': currentStatus }),
}));

import { getOrder } from '@/lib/orders';
import CommandeDetailPage from './page';

const mockGetOrder = getOrder as MockedFunction<typeof getOrder>;

const mockOrder = {
  id: 'o1',
  reference: 'EBA-20260511-AB12',
  customerName: 'Kofi',
  customerPhone: '07001234',
  pickupTime: new Date('2026-05-11T14:30:00'),
  items: [
    {
      cartId: 'c1',
      productId: 'p1',
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

describe('CommandeDetailPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('affiche les articles avec les suppléments', async () => {
    mockGetOrder.mockResolvedValue(mockOrder as never);
    const element = await CommandeDetailPage({
      params: Promise.resolve({ id: 'o1' }),
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain('Cappuccino');
    expect(html).toContain('Lait de soja');
    expect(html).toContain('x2');
  });

  it('passe le statut courant aux StatusButtons', async () => {
    mockGetOrder.mockResolvedValue(mockOrder as never);
    const element = await CommandeDetailPage({
      params: Promise.resolve({ id: 'o1' }),
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain('data-status="PENDING"');
  });

  it('retourne 404 pour un id inexistant', async () => {
    mockGetOrder.mockResolvedValue(null);
    await expect(
      CommandeDetailPage({ params: Promise.resolve({ id: 'inexistant' }) })
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('affiche la référence et les infos client', async () => {
    mockGetOrder.mockResolvedValue(mockOrder as never);
    const element = await CommandeDetailPage({
      params: Promise.resolve({ id: 'o1' }),
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain('EBA-20260511-AB12');
    expect(html).toContain('Kofi');
    expect(html).toContain('07001234');
  });

  it('affiche le total formaté en FCFA', async () => {
    mockGetOrder.mockResolvedValue(mockOrder as never);
    const element = await CommandeDetailPage({
      params: Promise.resolve({ id: 'o1' }),
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain('FCFA');
    expect(html).toMatch(/8.000/);
  });
});
```

- [ ] **Step 3 : Vérifier que les 10 tests échouent**

```bash
rtk vitest run "app/(dashboard)/dashboard/commandes/[id]/status-buttons.test.tsx" "app/(dashboard)/dashboard/commandes/[id]/page.test.tsx"
```

Résultat attendu : FAIL — module not found.

- [ ] **Step 4 : Créer StatusButtons**

Créer `app/(dashboard)/dashboard/commandes/[id]/status-buttons.tsx` :

```tsx
'use client';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { updateOrderStatus } from '../actions';
import type { OrderStatus } from '@/generated/prisma';

const ACTIONS: Record<
  string,
  {
    label: string;
    next: OrderStatus;
    variant?: 'default' | 'destructive' | 'outline';
  }[]
> = {
  PENDING: [
    { label: 'Confirmer', next: 'CONFIRMED' },
    { label: 'Annuler', next: 'CANCELLED', variant: 'destructive' },
  ],
  CONFIRMED: [
    { label: 'Marquer comme prête', next: 'READY' },
    { label: 'Annuler', next: 'CANCELLED', variant: 'destructive' },
  ],
  READY: [{ label: 'Marquer comme récupérée', next: 'PICKED_UP' }],
  PICKED_UP: [],
  CANCELLED: [],
};

export function StatusButtons({
  orderId,
  currentStatus,
}: {
  orderId: string;
  currentStatus: OrderStatus;
}) {
  const [isPending, startTransition] = useTransition();
  const actions = ACTIONS[currentStatus] ?? [];

  if (actions.length === 0) return null;

  const handleClick = (next: OrderStatus) => {
    startTransition(async () => {
      await updateOrderStatus(orderId, next);
    });
  };

  return (
    <div className="flex gap-2">
      {actions.map(({ label, next, variant = 'default' }) => (
        <Button
          key={next}
          variant={variant}
          disabled={isPending}
          onClick={() => handleClick(next)}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}
```

- [ ] **Step 5 : Créer la page détail**

Créer `app/(dashboard)/dashboard/commandes/[id]/page.tsx` :

```tsx
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getOrder } from '@/lib/orders';
import type { CartItem } from '@/lib/cart-store';
import type { OrderStatus } from '@/generated/prisma';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { StatusButtons } from './status-buttons';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmée',
  READY: 'Prête',
  PICKED_UP: 'Récupérée',
  CANCELLED: 'Annulée',
};

function formatPickupTime(date: Date): string {
  const dayMonth = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
  const time = new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(date)
    .replace(':', 'h');
  return `${dayMonth} · ${time}`;
}

export default async function CommandeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getOrder(id);

  if (!order) {
    notFound();
  }

  const items = order.items as CartItem[];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-3 mb-2">
            <Link href="/dashboard/commandes">← Retour</Link>
          </Button>
          <h1 className="font-mono text-2xl font-bold">{order.reference}</h1>
          <p className="text-muted-foreground">
            {formatPickupTime(order.pickupTime)}
          </p>
        </div>
        <Badge variant="secondary">{STATUS_LABELS[order.status]}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Client</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <p className="font-medium">{order.customerName}</p>
          <p className="text-muted-foreground">{order.customerPhone}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Articles</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-4">
            {items.map((item) => (
              <li key={item.cartId}>
                <div className="flex justify-between">
                  <span className="font-medium">
                    {item.productName} x{item.quantity}
                  </span>
                  <span>
                    {new Intl.NumberFormat('fr-FR').format(
                      (item.basePrice +
                        item.supplements.reduce((s, sup) => s + sup.price, 0)) *
                        item.quantity
                    )}{' '}
                    FCFA
                  </span>
                </div>
                {item.supplements.length > 0 && (
                  <ul className="mt-1 space-y-0.5 pl-4 text-sm text-muted-foreground">
                    {item.supplements.map((sup, i) => (
                      <li key={i}>
                        {sup.groupName} : {sup.optionName}
                        {sup.price > 0 ? ` (+${sup.price} FCFA)` : ''}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
          <Separator className="my-4" />
          <div className="flex justify-between font-bold">
            <span>Total</span>
            <span>
              {new Intl.NumberFormat('fr-FR').format(order.total)} FCFA
            </span>
          </div>
        </CardContent>
      </Card>

      <StatusButtons
        orderId={order.id}
        currentStatus={order.status as OrderStatus}
      />
    </div>
  );
}
```

- [ ] **Step 6 : Vérifier que les 10 tests passent**

```bash
rtk vitest run "app/(dashboard)/dashboard/commandes/[id]/status-buttons.test.tsx" "app/(dashboard)/dashboard/commandes/[id]/page.test.tsx"
```

Résultat attendu : PASS (5 + 5 = 10 tests).

- [ ] **Step 7 : Vérifier que tous les tests du projet passent**

```bash
rtk vitest run
```

Résultat attendu : PASS — tous les tests.

- [ ] **Step 8 : Commit**

```bash
rtk git add "app/(dashboard)/dashboard/commandes/[id]/"
rtk git commit -m "feat: add commande detail page with articles, supplements, and status buttons"
```

---

## Vérification de couverture spec

| Test spec F6                                                       | Couvert par                                          |
| ------------------------------------------------------------------ | ---------------------------------------------------- |
| La liste affiche toutes les commandes triées par date              | Task 2 — listOrders sort test + Task 4 — page test   |
| Le filtre "En attente" n'affiche que les PENDING                   | Task 2 — listOrders filter test + Task 4 — page test |
| La pagination retourne max 20 résultats par page                   | Task 2 — listOrders take:20 test                     |
| `updateOrderStatus(id, CONFIRMED)` avec session admin → met à jour | Task 3 — actions test                                |
| `updateOrderStatus` sans session admin → lève une erreur           | Task 3 — actions test                                |
| `updateOrderStatus` avec transition invalide → lève une erreur     | Task 3 — actions test                                |
| La vue détail affiche les articles avec leurs suppléments          | Task 5 — detail page test                            |
| Les boutons d'action correspondent au statut courant               | Task 5 — StatusButtons test                          |
