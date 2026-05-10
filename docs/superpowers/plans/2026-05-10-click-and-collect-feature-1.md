# Feature 1 — Schéma & Persistance Commandes — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter le modèle `Order` à Prisma, créer les routes `POST /api/commandes` et `GET /api/commandes/[id]` avec validation Zod, génération de référence unique, et tests TDD.

**Architecture:** La logique métier (validation, génération de référence, opérations DB) est isolée dans `lib/orders.ts`. Les route handlers sont de fins wrappers HTTP. Les tests mockent `@/lib/prisma` pour rester rapides et sans DB de test.

**Tech Stack:** Prisma 7 (pg adapter, client généré dans `generated/prisma`), Zod, Vitest, Next.js 16 App Router, Bun

---

## Structure des fichiers

| Action | Fichier                                | Responsabilité                                                      |
| ------ | -------------------------------------- | ------------------------------------------------------------------- |
| Modify | `prisma/schema.prisma`                 | Ajouter enum `OrderStatus` + model `Order`                          |
| Create | `lib/orders.ts`                        | Validation Zod, `generateOrderReference`, `createOrder`, `getOrder` |
| Create | `lib/orders.test.ts`                   | Tests unitaires de toute la logique métier                          |
| Create | `app/api/commandes/route.ts`           | Handler POST (fin wrapper)                                          |
| Create | `app/api/commandes/[id]/route.ts`      | Handler GET (fin wrapper)                                           |
| Create | `app/api/commandes/route.test.ts`      | Tests HTTP du POST handler                                          |
| Create | `app/api/commandes/[id]/route.test.ts` | Tests HTTP du GET handler                                           |
| Create | `vitest.config.ts`                     | Configuration vitest                                                |
| Modify | `package.json`                         | Ajouter scripts `test` et `test:watch`                              |

---

## Task 1 — Setup vitest + installer zod

**Files:**

- Create: `vitest.config.ts`
- Modify: `package.json`

- [ ] **Step 1 : Installer les dépendances**

```bash
bun add zod
bun add -D vitest
```

Résultat attendu : zod dans `dependencies`, vitest dans `devDependencies`.

- [ ] **Step 2 : Créer vitest.config.ts**

```ts
// vitest.config.ts
import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
```

- [ ] **Step 3 : Ajouter les scripts dans package.json**

Ouvrir `package.json`, trouver la section `"scripts"` et ajouter ces deux lignes :

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4 : Vérifier que vitest fonctionne**

Créer un fichier de smoke test temporaire :

```ts
// lib/smoke.test.ts
import { describe, it, expect } from 'vitest';

describe('vitest setup', () => {
  it('works', () => {
    expect(1 + 1).toBe(2);
  });
});
```

Lancer :

```bash
bun test
```

Résultat attendu :

```
✓ lib/smoke.test.ts (1)
  ✓ works

Test Files  1 passed (1)
Tests       1 passed (1)
```

- [ ] **Step 5 : Supprimer le smoke test**

```bash
del lib\smoke.test.ts
```

- [ ] **Step 6 : Commit**

```bash
rtk git add vitest.config.ts package.json bun.lock && rtk git commit -m "feat: setup vitest + install zod"
```

---

## Task 2 — Mettre à jour le schéma Prisma

**Files:**

- Modify: `prisma/schema.prisma`

- [ ] **Step 1 : Ajouter l'enum et le modèle au schéma**

Ouvrir `prisma/schema.prisma` et ajouter à la fin du fichier (après le modèle `Verification`) :

```prisma
enum OrderStatus {
  PENDING
  CONFIRMED
  READY
  PICKED_UP
  CANCELLED
}

model Order {
  id            String      @id @default(cuid())
  reference     String      @unique
  customerName  String
  customerPhone String
  pickupTime    DateTime
  items         Json
  total         Int
  status        OrderStatus @default(PENDING)
  note          String?
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  @@map("order")
}
```

- [ ] **Step 2 : Synchroniser le schéma avec la base de données**

```bash
bun run db:push
```

Résultat attendu : `Your database is now in sync with your Prisma schema.`

- [ ] **Step 3 : Régénérer le client Prisma**

```bash
bun run db:generate
```

Résultat attendu : `Generated Prisma Client` dans `generated/prisma`.

- [ ] **Step 4 : Vérifier que les types sont disponibles**

```bash
bun run build 2>&1 | head -20
```

Résultat attendu : pas d'erreur TypeScript liée à `Order` ou `OrderStatus`.

- [ ] **Step 5 : Commit**

```bash
rtk git add prisma/schema.prisma && rtk git commit -m "feat(db): add Order model and OrderStatus enum"
```

---

## Task 3 — TDD : lib/orders.ts — utilitaires purs

**Files:**

- Create: `lib/orders.ts`
- Create: `lib/orders.test.ts`

- [ ] **Step 1 : Créer lib/orders.test.ts avec les tests des utilitaires purs**

```ts
// lib/orders.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

    vi.mocked(prisma.order.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.order.create).mockResolvedValue(mockOrder);

    const result = await createOrder(validInput);

    expect(prisma.order.create).toHaveBeenCalledOnce();
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

    vi.mocked(prisma.order.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.order.create).mockResolvedValue(mockOrder);

    await createOrder(validInput);

    expect(prisma.order.create).toHaveBeenCalledWith(
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
    vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder);

    const result = await getOrder('clorder123');
    expect(result).toEqual(mockOrder);
    expect(prisma.order.findUnique).toHaveBeenCalledWith({
      where: { id: 'clorder123' },
    });
  });

  it("retourne null si la commande n'existe pas", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(null);

    const result = await getOrder('inexistant');
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2 : Lancer les tests (ils doivent échouer)**

```bash
bun test lib/orders.test.ts
```

Résultat attendu : `Cannot find module './orders'` ou erreur similaire — c'est normal.

- [ ] **Step 3 : Créer lib/orders.ts**

```ts
// lib/orders.ts
import { z } from 'zod';
import prisma from '@/lib/prisma';

// ─── Schémas Zod ──────────────────────────────────────────────────────────────

const cartItemSupplementSchema = z.object({
  groupName: z.string(),
  optionName: z.string(),
  price: z.number().int().nonnegative(),
});

const cartItemSchema = z.object({
  cartId: z.string(),
  productId: z.string(),
  productName: z.string(),
  basePrice: z.number().int().nonnegative(),
  quantity: z.number().int().positive(),
  supplements: z.array(cartItemSupplementSchema),
});

export const createOrderSchema = z.object({
  customerName: z.string().min(2).max(50),
  customerPhone: z.string().min(8).max(20),
  pickupTime: z.string().datetime(),
  items: z.array(cartItemSchema).min(1),
  total: z.number().int().positive(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

// ─── Génération de référence ──────────────────────────────────────────────────

export function generateOrderReference(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const suffix = Array.from(
    { length: 4 },
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join('');
  return `EBA-${dateStr}-${suffix}`;
}

// ─── Opérations DB ────────────────────────────────────────────────────────────

export async function createOrder(input: CreateOrderInput) {
  const reference = generateOrderReference();

  return prisma.order.create({
    data: {
      reference,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      pickupTime: new Date(input.pickupTime),
      items: input.items,
      total: input.total,
    },
  });
}

export async function getOrder(id: string) {
  return prisma.order.findUnique({ where: { id } });
}
```

- [ ] **Step 4 : Lancer les tests (ils doivent passer)**

```bash
bun test lib/orders.test.ts
```

Résultat attendu :

```
✓ lib/orders.test.ts (15)
  ✓ generateOrderReference > suit le format EBA-YYYYMMDD-[A-Z0-9]{4}
  ✓ generateOrderReference > contient la date du jour
  ✓ generateOrderReference > génère des références différentes à chaque appel
  ✓ createOrderSchema > accepte un body valide
  ✓ createOrderSchema > rejette items vide
  ...

Test Files  1 passed (1)
Tests       15 passed (15)
```

- [ ] **Step 5 : Commit**

```bash
rtk git add lib/orders.ts lib/orders.test.ts && rtk git commit -m "feat: add order business logic with TDD (generateOrderReference, createOrderSchema, createOrder, getOrder)"
```

---

## Task 4 — TDD : POST /api/commandes

**Files:**

- Create: `app/api/commandes/route.ts`
- Create: `app/api/commandes/route.test.ts`

- [ ] **Step 1 : Créer le fichier de test**

```ts
// app/api/commandes/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  default: {
    order: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

import prisma from '@/lib/prisma';
import { POST } from './route';

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
  });

  it('retourne 201 avec id et reference pour un body valide', async () => {
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
    vi.mocked(prisma.order.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.order.create).mockResolvedValue(mockOrder);

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
    vi.mocked(prisma.order.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.order.create).mockRejectedValue(new Error('DB error'));

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(500);
  });
});
```

- [ ] **Step 2 : Lancer les tests (ils doivent échouer)**

```bash
bun test app/api/commandes/route.test.ts
```

Résultat attendu : `Cannot find module './route'` — c'est normal.

- [ ] **Step 3 : Créer app/api/commandes/route.ts**

```ts
// app/api/commandes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createOrder, createOrderSchema } from '@/lib/orders';

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Corps de requête invalide' },
      { status: 400 }
    );
  }

  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const order = await createOrder(parsed.data);
    return NextResponse.json(
      { id: order.id, reference: order.reference },
      { status: 201 }
    );
  } catch (err) {
    console.error('[POST /api/commandes]', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
```

- [ ] **Step 4 : Lancer les tests (ils doivent passer)**

```bash
bun test app/api/commandes/route.test.ts
```

Résultat attendu :

```
✓ app/api/commandes/route.test.ts (7)
  ✓ POST /api/commandes > retourne 201 avec id et reference pour un body valide
  ✓ POST /api/commandes > retourne 400 si items est vide
  ...

Test Files  1 passed (1)
Tests       7 passed (7)
```

- [ ] **Step 5 : Commit**

```bash
rtk git add app/api/commandes/route.ts app/api/commandes/route.test.ts && rtk git commit -m "feat: add POST /api/commandes route with TDD"
```

---

## Task 5 — TDD : GET /api/commandes/[id]

**Files:**

- Create: `app/api/commandes/[id]/route.ts`
- Create: `app/api/commandes/[id]/route.test.ts`

- [ ] **Step 1 : Créer le fichier de test**

```ts
// app/api/commandes/[id]/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
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
    vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder);

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
    vi.mocked(prisma.order.findUnique).mockResolvedValue(null);

    const res = await GET(makeRequest('inexistant'), {
      params: Promise.resolve({ id: 'inexistant' }),
    });

    expect(res.status).toBe(404);
  });

  it('appelle prisma avec le bon id', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder);

    await GET(makeRequest('clorder123'), {
      params: Promise.resolve({ id: 'clorder123' }),
    });

    expect(prisma.order.findUnique).toHaveBeenCalledWith({
      where: { id: 'clorder123' },
    });
  });
});
```

- [ ] **Step 2 : Lancer les tests (ils doivent échouer)**

```bash
bun test "app/api/commandes/[id]/route.test.ts"
```

Résultat attendu : `Cannot find module './route'` — c'est normal.

- [ ] **Step 3 : Créer app/api/commandes/[id]/route.ts**

```ts
// app/api/commandes/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getOrder } from '@/lib/orders';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const order = await getOrder(id);

  if (!order) {
    return NextResponse.json(
      { error: 'Commande introuvable' },
      { status: 404 }
    );
  }

  return NextResponse.json(order);
}
```

- [ ] **Step 4 : Lancer les tests (ils doivent passer)**

```bash
bun test "app/api/commandes/[id]/route.test.ts"
```

Résultat attendu :

```
✓ app/api/commandes/[id]/route.test.ts (3)
  ✓ GET /api/commandes/[id] > retourne 200 avec la commande si elle existe
  ✓ GET /api/commandes/[id] > retourne 404 si la commande n'existe pas
  ✓ GET /api/commandes/[id] > appelle prisma avec le bon id

Test Files  1 passed (1)
Tests       3 passed (3)
```

- [ ] **Step 5 : Lancer tous les tests pour vérifier qu'aucune régression**

```bash
bun test
```

Résultat attendu :

```
✓ lib/orders.test.ts (15)
✓ app/api/commandes/route.test.ts (7)
✓ app/api/commandes/[id]/route.test.ts (3)

Test Files  3 passed (3)
Tests       25 passed (25)
```

- [ ] **Step 6 : Vérifier le build TypeScript**

```bash
bun run build 2>&1 | head -30
```

Résultat attendu : pas d'erreurs TypeScript.

- [ ] **Step 7 : Commit final**

```bash
rtk git add app/api/commandes/ && rtk git commit -m "feat: add GET /api/commandes/[id] route with TDD"
```

---

## Vérification end-to-end

Une fois tous les tests passés, tester manuellement avec le serveur de dev :

```bash
bun dev
```

```bash
# Créer une commande
curl -X POST http://localhost:3000/api/commandes \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "Kofi",
    "customerPhone": "0700123456",
    "pickupTime": "2026-05-11T10:30:00.000Z",
    "items": [{"cartId":"x","productId":"espresso","productName":"Espresso","basePrice":2000,"quantity":1,"supplements":[]}],
    "total": 2000
  }'
# Attendu : {"id":"cl...","reference":"EBA-20260511-XXXX"}

# Récupérer la commande
curl http://localhost:3000/api/commandes/<id-retourné>
# Attendu : objet complet avec status "PENDING"

# Tester un body invalide
curl -X POST http://localhost:3000/api/commandes \
  -H "Content-Type: application/json" \
  -d '{"customerName":"K","items":[],"total":-1}'
# Attendu : 400
```

---

## Checklist spec (auto-review)

- [x] `POST /api/commandes` avec body valide → 201 + `{ id, reference }` ✓ Task 4
- [x] `POST /api/commandes` avec items vide → 400 ✓ Task 4
- [x] `POST /api/commandes` avec téléphone trop court → 400 ✓ Task 4
- [x] `POST /api/commandes` avec total négatif → 400 ✓ Task 4
- [x] `POST /api/commandes` avec pickupTime invalide → 400 ✓ Task 4
- [x] `GET /api/commandes/[id]` avec id existant → 200 ✓ Task 5
- [x] `GET /api/commandes/[id]` avec id inexistant → 404 ✓ Task 5
- [x] Référence suit le format `EBA-YYYYMMDD-[A-Z0-9]{4}` ✓ Task 3
- [x] Statut initial toujours `PENDING` ✓ Task 3
