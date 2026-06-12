# F7 — Migration menu en base — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrer le menu statique (`config/menu.ts`) vers PostgreSQL via quatre nouveaux modèles Prisma, et mettre à jour `CarteMenuSection` pour lire les données depuis la DB.

**Architecture:** Quatre modèles Prisma (`MenuCategory`, `Product`, `SupplementGroup`, `SupplementOption`) sont ajoutés au schéma et peuplés par un script de seed. `lib/menu.ts` expose `getMenu()` qui interroge la DB et retourne les données dans le format attendu par les composants existants (types de `config/menu.ts`). `CarteMenuSection` est splittée : un Server Component async appelle `getMenu()` et passe les données à un nouveau `CarteMenuSectionClient` qui gère l'interactivité (IntersectionObserver, navigation sticky). Les composants `ProductCard` et `SupplementModal` ne changent pas.

**Tech Stack:** Prisma 7, PostgreSQL, Next.js 16 App Router Server Components, Bun, Vitest, react-dom/server (tests).

---

## Fichiers créés/modifiés

| Fichier                                                   | Action   | Rôle                                                                                    |
| --------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------- |
| `prisma/schema.prisma`                                    | Modifier | Ajouter `MenuCategory`, `Product`, `SupplementGroup`, `SupplementOption`                |
| `prisma/seed.ts`                                          | Créer    | Script seed — lit `config/menu.ts`, insère en DB                                        |
| `prisma/seed.test.ts`                                     | Créer    | Tests TDD de `seedMenu`                                                                 |
| `package.json`                                            | Modifier | Ajouter script `db:seed`                                                                |
| `lib/menu.ts`                                             | Créer    | `getMenu()` — query DB + mapping vers types `config/menu.ts`                            |
| `lib/menu.test.ts`                                        | Créer    | Tests TDD de `getMenu`                                                                  |
| `app/api/menu/route.ts`                                   | Créer    | `GET /api/menu` avec revalidation 60s                                                   |
| `app/api/menu/route.test.ts`                              | Créer    | Tests TDD de la route                                                                   |
| `components/(public)/carte/carte-menu-section-client.tsx` | Créer    | Client Component — interactivité (extrait de l'actuel `carte-menu-section.tsx`)         |
| `components/(public)/carte/carte-menu-section.tsx`        | Modifier | Devient Server Component async — appelle `getMenu()`, passe données au Client Component |
| `components/(public)/carte/carte-menu-section.test.tsx`   | Créer    | Test Server Component                                                                   |

---

## Task 1 — Schéma Prisma : 4 nouveaux modèles

**Files:**

- Modify: `prisma/schema.prisma`

- [ ] **Step 1 : Ajouter les modèles à la fin de `prisma/schema.prisma`**

Ajouter après le modèle `Order` existant :

```prisma
model MenuCategory {
  id        String    @id @default(cuid())
  name      String
  slug      String    @unique
  sortOrder Int       @default(0)
  available Boolean   @default(true)
  products  Product[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  @@map("menu_category")
}

model Product {
  id               String            @id @default(cuid())
  name             String
  description      String
  price            Int
  imageUrl         String?
  available        Boolean           @default(true)
  sortOrder        Int               @default(0)
  categoryId       String
  category         MenuCategory      @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  supplementGroups SupplementGroup[]
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt

  @@map("product")
}

model SupplementGroup {
  id        String             @id @default(cuid())
  name      String
  type      String
  required  Boolean            @default(false)
  sortOrder Int                @default(0)
  productId String
  product   Product            @relation(fields: [productId], references: [id], onDelete: Cascade)
  options   SupplementOption[]

  @@map("supplement_group")
}

model SupplementOption {
  id      String          @id @default(cuid())
  name    String
  price   Int
  groupId String
  group   SupplementGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)

  @@map("supplement_option")
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
rtk git commit -m "feat: add MenuCategory, Product, SupplementGroup, SupplementOption models"
```

---

## Task 2 — Script de seed (TDD)

**Files:**

- Create: `prisma/seed.ts`
- Create: `prisma/seed.test.ts`
- Modify: `package.json`

- [ ] **Step 1 : Écrire les tests**

Créer `prisma/seed.test.ts` :

```ts
// prisma/seed.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/generated/prisma', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    $disconnect: vi.fn(),
  })),
}));

import { menu } from '@/config/menu';
import { seedMenu } from './seed';

describe('seedMenu', () => {
  it('insère exactement le même nombre de catégories que config/menu.ts', async () => {
    const mockCreate = vi.fn().mockResolvedValue({ id: 'cat-mock' });
    const mockPrisma = { menuCategory: { create: mockCreate } };

    await seedMenu(mockPrisma as never);

    expect(mockCreate).toHaveBeenCalledTimes(menu.length); // 4
  });

  it('insère les produits dans la première catégorie', async () => {
    const mockCreate = vi.fn().mockResolvedValue({ id: 'cat-mock' });
    const mockPrisma = { menuCategory: { create: mockCreate } };

    await seedMenu(mockPrisma as never);

    const firstCall = mockCreate.mock.calls[0][0];
    expect(firstCall.data.products.create.length).toBe(menu[0].products.length); // 5
  });

  it('insère les groupes et options de suppléments pour cappuccino', async () => {
    const mockCreate = vi.fn().mockResolvedValue({ id: 'cat-mock' });
    const mockPrisma = { menuCategory: { create: mockCreate } };

    await seedMenu(mockPrisma as never);

    // cappuccino = index 1 de la catégorie 0, a milkChoice (3 options) + coffeeExtras (4 options)
    const firstCall = mockCreate.mock.calls[0][0];
    const cappuccino = firstCall.data.products.create[1];
    expect(cappuccino.supplementGroups.create.length).toBe(2);
    expect(cappuccino.supplementGroups.create[0].options.create.length).toBe(3);
    expect(cappuccino.supplementGroups.create[1].options.create.length).toBe(4);
  });

  it("utilise l'id de la catégorie config comme slug", async () => {
    const mockCreate = vi.fn().mockResolvedValue({ id: 'cat-mock' });
    const mockPrisma = { menuCategory: { create: mockCreate } };

    await seedMenu(mockPrisma as never);

    const firstCall = mockCreate.mock.calls[0][0];
    expect(firstCall.data.slug).toBe('boissons-chaudes');
  });
});
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```bash
rtk vitest run prisma/seed.test.ts
```

Résultat attendu : FAIL — `seedMenu` n'est pas encore exportée.

- [ ] **Step 3 : Créer le script de seed**

Créer `prisma/seed.ts` :

```ts
// prisma/seed.ts
import { PrismaClient } from '@/generated/prisma';
import { menu } from '@/config/menu';

type SeedablePrisma = {
  menuCategory: {
    create: (args: unknown) => Promise<unknown>;
  };
};

export async function seedMenu(prisma: SeedablePrisma) {
  for (let i = 0; i < menu.length; i++) {
    const category = menu[i];
    await prisma.menuCategory.create({
      data: {
        name: category.name,
        slug: category.id,
        sortOrder: i,
        products: {
          create: category.products.map((p, pi) => ({
            name: p.name,
            description: p.description,
            price: p.price,
            sortOrder: pi,
            supplementGroups: {
              create: (p.supplements ?? []).map((g, gi) => ({
                name: g.name,
                type: g.type,
                required: g.required,
                sortOrder: gi,
                options: {
                  create: g.options.map((o) => ({
                    name: o.name,
                    price: o.price,
                  })),
                },
              })),
            },
          })),
        },
      },
    });
  }
}

async function main() {
  const prisma = new PrismaClient();
  try {
    await seedMenu(prisma as SeedablePrisma);
    console.log('Seed terminé avec succès.');
  } finally {
    await prisma.$disconnect();
  }
}

// Bun : import.meta.main est true uniquement quand ce fichier est l'entrypoint
if (import.meta.main) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
```

- [ ] **Step 4 : Vérifier que les 4 tests passent**

```bash
rtk vitest run prisma/seed.test.ts
```

Résultat attendu : PASS (4 tests).

- [ ] **Step 5 : Ajouter le script dans `package.json`**

Dans la section `"scripts"` de `package.json`, ajouter après `"db:studio"` :

```json
"db:seed": "bun run prisma/seed.ts",
```

- [ ] **Step 6 : Commit**

```bash
rtk git add prisma/seed.ts prisma/seed.test.ts package.json
rtk git commit -m "feat: add menu seed script and db:seed command"
```

---

## Task 3 — `lib/menu.ts` : `getMenu()` (TDD)

**Files:**

- Create: `lib/menu.ts`
- Create: `lib/menu.test.ts`

- [ ] **Step 1 : Écrire les tests**

Créer `lib/menu.test.ts` :

```ts
// lib/menu.test.ts
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
    menuCategory: {
      findMany: vi.fn(),
    },
  },
}));

import prisma from '@/lib/prisma';
import { getMenu } from './menu';

const mockFindMany = prisma.menuCategory.findMany as MockedFunction<
  typeof prisma.menuCategory.findMany
>;

const mockDbData = [
  {
    id: 'cat1',
    name: 'Boissons chaudes',
    slug: 'boissons-chaudes',
    sortOrder: 0,
    available: true,
    products: [
      {
        id: 'prod1',
        name: 'Espresso',
        description: 'Court et intense',
        price: 1500,
        imageUrl: null,
        available: true,
        sortOrder: 0,
        categoryId: 'cat1',
        supplementGroups: [
          {
            id: 'grp1',
            name: 'Extras',
            type: 'multiple',
            required: false,
            sortOrder: 0,
            productId: 'prod1',
            options: [
              {
                id: 'opt1',
                name: 'Shot espresso',
                price: 300,
                groupId: 'grp1',
              },
            ],
          },
        ],
      },
    ],
  },
];

describe('getMenu', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('retourne les catégories avec leurs produits et suppléments', async () => {
    mockFindMany.mockResolvedValue(mockDbData as never);
    const result = await getMenu();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Boissons chaudes');
    expect(result[0].products).toHaveLength(1);
    expect(result[0].products[0].name).toBe('Espresso');
  });

  it('mappe imageUrl vers image', async () => {
    const dataWithImage = [
      {
        ...mockDbData[0],
        products: [
          {
            ...mockDbData[0].products[0],
            imageUrl: 'https://blob.vercel.com/img.jpg',
          },
        ],
      },
    ];
    mockFindMany.mockResolvedValue(dataWithImage as never);
    const result = await getMenu();
    expect(result[0].products[0].image).toBe('https://blob.vercel.com/img.jpg');
  });

  it('imageUrl null → image undefined', async () => {
    mockFindMany.mockResolvedValue(mockDbData as never);
    const result = await getMenu();
    expect(result[0].products[0].image).toBeUndefined();
  });

  it('mappe les groupes de suppléments avec leurs options', async () => {
    mockFindMany.mockResolvedValue(mockDbData as never);
    const result = await getMenu();
    const sups = result[0].products[0].supplements;
    expect(sups).toHaveLength(1);
    expect(sups![0].name).toBe('Extras');
    expect(sups![0].type).toBe('multiple');
    expect(sups![0].options[0].name).toBe('Shot espresso');
    expect(sups![0].options[0].price).toBe(300);
  });

  it('utilise le slug de catégorie comme id (pour les ancres HTML)', async () => {
    mockFindMany.mockResolvedValue(mockDbData as never);
    const result = await getMenu();
    expect(result[0].id).toBe('boissons-chaudes');
  });

  it('filtre les catégories available:false', async () => {
    mockFindMany.mockResolvedValue([]);
    await getMenu();
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { available: true } })
    );
  });

  it('filtre les produits available:false', async () => {
    mockFindMany.mockResolvedValue([]);
    await getMenu();
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          products: expect.objectContaining({
            where: { available: true },
          }),
        }),
      })
    );
  });

  it('trie les catégories par sortOrder ASC', async () => {
    mockFindMany.mockResolvedValue([]);
    await getMenu();
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { sortOrder: 'asc' } })
    );
  });
});
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```bash
rtk vitest run lib/menu.test.ts
```

Résultat attendu : FAIL — `getMenu` n'est pas encore définie.

- [ ] **Step 3 : Implémenter `lib/menu.ts`**

Créer `lib/menu.ts` :

```ts
// lib/menu.ts
import prisma from '@/lib/prisma';
import type { MenuCategory } from '@/config/menu';

export async function getMenu(): Promise<MenuCategory[]> {
  const categories = await prisma.menuCategory.findMany({
    where: { available: true },
    orderBy: { sortOrder: 'asc' },
    include: {
      products: {
        where: { available: true },
        orderBy: { sortOrder: 'asc' },
        include: {
          supplementGroups: {
            orderBy: { sortOrder: 'asc' },
            include: {
              options: true,
            },
          },
        },
      },
    },
  });

  return categories.map((cat) => ({
    id: cat.slug,
    name: cat.name,
    products: cat.products.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price: p.price,
      image: p.imageUrl ?? undefined,
      supplements: p.supplementGroups.map((g) => ({
        name: g.name,
        type: g.type as 'single' | 'multiple',
        required: g.required,
        options: g.options.map((o) => ({
          name: o.name,
          price: o.price,
        })),
      })),
    })),
  }));
}
```

- [ ] **Step 4 : Vérifier que les 8 tests passent**

```bash
rtk vitest run lib/menu.test.ts
```

Résultat attendu : PASS (8 tests).

- [ ] **Step 5 : Commit**

```bash
rtk git add lib/menu.ts lib/menu.test.ts
rtk git commit -m "feat: add getMenu with DB query, available filter, sortOrder, and type mapping"
```

---

## Task 4 — Route `GET /api/menu` (TDD)

**Files:**

- Create: `app/api/menu/route.ts`
- Create: `app/api/menu/route.test.ts`

- [ ] **Step 1 : Écrire les tests**

Créer `app/api/menu/route.test.ts` :

```ts
// app/api/menu/route.test.ts
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  type MockedFunction,
} from 'vitest';

vi.mock('@/lib/menu', () => ({
  getMenu: vi.fn(),
}));

import { getMenu } from '@/lib/menu';
import { GET } from './route';

const mockGetMenu = getMenu as MockedFunction<typeof getMenu>;

const mockMenu = [
  {
    id: 'boissons-chaudes',
    name: 'Boissons chaudes',
    products: [
      {
        id: 'prod1',
        name: 'Espresso',
        description: 'Court et intense',
        price: 1500,
        supplements: [],
      },
    ],
  },
];

describe('GET /api/menu', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('retourne les catégories avec leurs produits (200)', async () => {
    mockGetMenu.mockResolvedValue(mockMenu as never);
    const response = await GET();
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe('Boissons chaudes');
    expect(data[0].products[0].name).toBe('Espresso');
  });

  it('retourne 500 si getMenu lance une erreur', async () => {
    mockGetMenu.mockRejectedValue(new Error('DB error'));
    const response = await GET();
    expect(response.status).toBe(500);
  });
});
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```bash
rtk vitest run "app/api/menu/route.test.ts"
```

Résultat attendu : FAIL — module not found.

- [ ] **Step 3 : Créer la route**

Créer `app/api/menu/route.ts` :

```ts
// app/api/menu/route.ts
import { NextResponse } from 'next/server';
import { getMenu } from '@/lib/menu';

export const revalidate = 60;

export async function GET() {
  try {
    const menu = await getMenu();
    return NextResponse.json(menu);
  } catch (err) {
    console.error('[GET /api/menu]', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
```

- [ ] **Step 4 : Vérifier que les 2 tests passent**

```bash
rtk vitest run "app/api/menu/route.test.ts"
```

Résultat attendu : PASS (2 tests).

- [ ] **Step 5 : Commit**

```bash
rtk git add app/api/menu/route.ts app/api/menu/route.test.ts
rtk git commit -m "feat: add GET /api/menu route with 60s revalidation"
```

---

## Task 5 — Migration CarteMenuSection (Server + Client split)

**Files:**

- Create: `components/(public)/carte/carte-menu-section-client.tsx`
- Modify: `components/(public)/carte/carte-menu-section.tsx`
- Create: `components/(public)/carte/carte-menu-section.test.tsx`

- [ ] **Step 1 : Créer le Client Component**

Créer `components/(public)/carte/carte-menu-section-client.tsx` — reprend toute la logique interactive de l'actuel `carte-menu-section.tsx`, mais reçoit `menuData` en prop au lieu d'importer depuis config :

```tsx
// components/(public)/carte/carte-menu-section-client.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { MenuCategory } from '@/config/menu';
import ProductCard from '@/components/(public)/carte/product-card';

type Props = {
  menuData: MenuCategory[];
};

function CarteMenuSectionClient({ menuData }: Props) {
  const reduceMotion = useReducedMotion();
  const [activeId, setActiveId] = useState(menuData[0]?.id ?? '');
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());
  const navRef = useRef<HTMLDivElement>(null);
  const isScrollingTo = useRef(false);

  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    sectionRefs.current.forEach((el, id) => {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting && !isScrollingTo.current) {
            setActiveId(id);
          }
        },
        { rootMargin: '-120px 0px -60% 0px', threshold: 0 }
      );
      observer.observe(el);
      observers.push(observer);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  function scrollToCategory(id: string) {
    const el = sectionRefs.current.get(id);
    if (!el) return;

    isScrollingTo.current = true;
    setActiveId(id);

    const navHeight = navRef.current?.offsetHeight ?? 0;
    const top =
      el.getBoundingClientRect().top + window.scrollY - navHeight - 80;
    window.scrollTo({ top, behavior: 'smooth' });

    setTimeout(() => {
      isScrollingTo.current = false;
    }, 800);
  }

  useEffect(() => {
    if (!navRef.current) return;
    const activeBtn = navRef.current.querySelector('[data-active="true"]');
    if (activeBtn) {
      activeBtn.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [activeId]);

  return (
    <section
      aria-label="Menu EBA Coffee Shop"
      className="bg-[linear-gradient(180deg,rgba(255,252,248,1)_0%,rgba(247,239,232,1)_100%)] pb-14 md:pb-20"
    >
      <div
        ref={navRef}
        className="sticky top-16 z-30 border-b border-foreground/5 bg-background/90 backdrop-blur-sm"
      >
        <div className="content-container">
          <nav
            className="flex gap-1 overflow-x-auto py-3 scrollbar-none"
            aria-label="Catégories du menu"
          >
            {menuData.map((cat) => (
              <button
                key={cat.id}
                data-active={activeId === cat.id}
                onClick={() => scrollToCategory(cat.id)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-200 ${
                  activeId === cat.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground/60 hover:bg-foreground/5 hover:text-foreground'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="content-container mt-6 space-y-10 md:mt-8 md:space-y-14">
        {menuData.map((category) => (
          <div
            key={category.id}
            id={category.id}
            ref={(el) => {
              if (el) sectionRefs.current.set(category.id, el);
            }}
          >
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {category.name}
            </h2>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {category.products.map((product, i) => (
                <motion.div
                  key={product.id}
                  initial={reduceMotion ? undefined : { opacity: 0, y: 16 }}
                  whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.15 }}
                  transition={
                    reduceMotion
                      ? undefined
                      : { duration: 0.4, delay: i * 0.05, ease: 'easeOut' }
                  }
                >
                  <ProductCard product={product} />
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default CarteMenuSectionClient;
```

- [ ] **Step 2 : Écrire le test du Server Component**

Créer `components/(public)/carte/carte-menu-section.test.tsx` :

```tsx
// components/(public)/carte/carte-menu-section.test.tsx
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

vi.mock('@/lib/menu', () => ({
  getMenu: vi.fn(),
}));

vi.mock('./carte-menu-section-client', () => ({
  default: ({
    menuData,
  }: {
    menuData: { id: string; name: string; products: unknown[] }[];
  }) =>
    React.createElement(
      'div',
      null,
      menuData.map((cat) =>
        React.createElement('span', { key: cat.id }, cat.name)
      )
    ),
}));

import { getMenu } from '@/lib/menu';
import CarteMenuSection from './carte-menu-section';

const mockGetMenu = getMenu as MockedFunction<typeof getMenu>;

describe('CarteMenuSection', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('passe les catégories DB au Client Component', async () => {
    mockGetMenu.mockResolvedValue([
      { id: 'boissons-chaudes', name: 'Boissons chaudes', products: [] },
      { id: 'patisseries', name: 'Pâtisseries', products: [] },
    ] as never);

    const element = await CarteMenuSection();
    const html = renderToStaticMarkup(element);

    expect(html).toContain('Boissons chaudes');
    expect(html).toContain('Pâtisseries');
  });
});
```

- [ ] **Step 3 : Vérifier que le test échoue**

```bash
rtk vitest run "components/(public)/carte/carte-menu-section.test.tsx"
```

Résultat attendu : FAIL — l'actuel `carte-menu-section.tsx` importe depuis config, pas depuis `getMenu`.

- [ ] **Step 4 : Transformer `carte-menu-section.tsx` en Server Component**

Remplacer tout le contenu de `components/(public)/carte/carte-menu-section.tsx` :

```tsx
// components/(public)/carte/carte-menu-section.tsx
import { getMenu } from '@/lib/menu';
import CarteMenuSectionClient from './carte-menu-section-client';

export default async function CarteMenuSection() {
  const menuData = await getMenu();
  return <CarteMenuSectionClient menuData={menuData} />;
}
```

- [ ] **Step 5 : Vérifier que le test passe**

```bash
rtk vitest run "components/(public)/carte/carte-menu-section.test.tsx"
```

Résultat attendu : PASS (1 test).

- [ ] **Step 6 : Vérifier que tous les tests du projet passent**

```bash
rtk vitest run
```

Résultat attendu : PASS — tous les tests existants + nouveaux.

- [ ] **Step 7 : Commit**

```bash
rtk git add "components/(public)/carte/carte-menu-section.tsx" "components/(public)/carte/carte-menu-section-client.tsx" "components/(public)/carte/carte-menu-section.test.tsx"
rtk git commit -m "feat: migrate CarteMenuSection to Server Component fetching from DB"
```

---

## Vérification de couverture spec

| Test spec F7                                                                  | Couvert par                                 |
| ----------------------------------------------------------------------------- | ------------------------------------------- |
| `GET /api/menu` retourne les catégories avec leurs produits et suppléments    | Task 4 — route test                         |
| `GET /api/menu` exclut les produits `available: false`                        | Task 3 — `getMenu` test (filtre products)   |
| `GET /api/menu` exclut les catégories `available: false`                      | Task 3 — `getMenu` test (filtre catégories) |
| `GET /api/menu` trie les catégories par `sortOrder` ASC                       | Task 3 — `getMenu` test (orderBy)           |
| Le seed insère exactement le même nombre de catégories que `config/menu.ts`   | Task 2 — seed test                          |
| Le seed insère tous les produits avec leurs groupes et options de suppléments | Task 2 — seed test (cappuccino)             |
| La page `/carte` affiche le même menu après migration qu'avant                | Task 5 — CarteMenuSection test              |
